# FarmaSnap — Especificación de diseño

- **Fecha:** 2026-10-18
- **Estado:** Diseño aprobado por secciones; pendiente de revisión de este documento
- **Maquetas:** [`docs/mockups/`](../../mockups/) (imágenes y `pantallas.html`)

---

## 1. Propósito

FarmaSnap es una app móvil para **uso familiar** que mantiene el inventario de los
medicamentos que hay en casa. Su objetivo principal es responder, en el momento de
comprar, la pregunta:

> **"¿Ya tenemos este medicamento en casa?"**

### Usuarios
- Los integrantes de una familia, cada uno desde su teléfono Android.
- Todos comparten **un único inventario** (el de la casa). No hay filtrado por usuario:
  cualquier familiar con sesión ve y edita todo.

### Criterios de éxito
1. Registrar un medicamento toma menos de 30 segundos: foto, revisar, guardar.
2. En la farmacia, una foto de la caja indica en pocos segundos si ya lo tenemos, si
   tenemos un equivalente (mismo principio activo) o si no lo tenemos.
3. Un cambio hecho por un familiar aparece en los demás teléfonos sin recargar.
4. El costo operativo es prácticamente nulo para una familia (planes gratuitos más
   centavos de IA).

### Contexto
- **País:** Chile. No existe una API ni una descarga pública del registro de medicamentos
  del ISP, así que la identificación depende de la lectura de la caja con IA y de la
  confirmación del usuario.
- **Mercado:** existen apps similares (PillBox Keeper, Home Med Cabinet, MyAidKit),
  casi todas solo para iOS, sin inventario familiar compartido y sin búsqueda de
  equivalentes por principio activo a partir de una foto.

## 2. Alcance

### Incluido (v1)
- Inicio de sesión con cuentas creadas por el administrador; el registro público está desactivado.
- Inventario compartido con la cantidad de **envases** por medicamento.
- Registro por foto, con extracción automática por IA y un formulario editable.
- Registro manual cuando la IA no puede leer la caja.
- Búsqueda por texto, por nombre comercial y por principio activo, tolerante a tildes,
  mayúsculas y errores de tipeo.
- Búsqueda por foto con tres resultados: *ya lo tienes*, *tienes un equivalente* o *no lo tienes*.
- Sumar o restar envases, editar y eliminar medicamentos.
- Sincronización en tiempo real entre teléfonos.
- Consulta del inventario sin conexión, en solo lectura, con la última copia descargada.

### Excluido (posibles versiones futuras)
- Fechas de caducidad y alertas.
- Conteo de unidades (pastillas) y recordatorios de tomas.
- Versión web y app para iOS (Expo lo permite más adelante sin reescribir).
- Varios botiquines o "casas" por usuario.
- Edición sin conexión con cola de sincronización.
- Integración con bases oficiales de medicamentos.

## 3. Arquitectura

```
App Expo (Android, TypeScript)
   │  supabase-js (sesión del usuario)
   ▼
Supabase
   • Auth ........ cuentas creadas por el administrador
   • Postgres .... tabla `medicamentos` + funciones SQL + RLS
   • Storage ..... bucket privado `fotos` (fotos de las cajas)
   • Realtime .... cambios de `medicamentos` en vivo
   • Edge Function `analizar-foto` ──► Claude Haiku 5.5 (claude-haiku-5-5)
```

### Componentes

| Unidad | Responsabilidad | Depende de |
|---|---|---|
| **App móvil** (Expo + Expo Router + TypeScript) | Pantallas, cámara, reducción de la imagen, caché local | Cliente Supabase, módulo `dominio` |
| **Módulo `dominio`** (TS puro, sin UI) | Normalización de texto y de dosis, búsqueda por texto tolerante a errores, detección de duplicados y clasificación del resultado de la búsqueda por foto | Nada |
| **Postgres** | Persistencia, unicidad, cambios atómicos de cantidad, límite de uso de IA | Extensión `unaccent` |
| **Edge Function `analizar-foto`** | Validar la sesión, aplicar el límite diario, llamar a Claude y devolver JSON validado | API de Anthropic (la clave vive solo aquí) |

### Decisiones clave
- **Expo en lugar de Android Studio:** el desarrollo se hace con Expo Go en un teléfono
  físico y el APK se compila en la nube con EAS Build. Android Studio no es necesario.
- **La IA se ejecuta en el servidor:** la clave de Anthropic nunca se incluye en la app.
- **Una sola función de IA** para registrar y para buscar; cambia solo lo que la app hace con el resultado.
- **Búsqueda en el teléfono:** el inventario de una casa es pequeño (decenas o pocos cientos
  de filas), así que la app descarga la lista completa, que ya necesita para la pantalla
  principal, la caché y el tiempo real, y busca sobre ella con el módulo `dominio`. Así la
  búsqueda funciona igual con y sin conexión, y no se necesitan funciones de búsqueda en SQL.

## 4. Modelo de datos

### Tabla `medicamentos`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `nombre_comercial` | `text` | Obligatorio, sin espacios sobrantes |
| `principios_activos` | `text[]` | Nombres genéricos en minúsculas y en español; puede estar vacío |
| `dosis` | `text` | Opcional, por ejemplo "500 mg" o "1 g" |
| `forma` | `text` | Opcional: comprimidos, cápsulas, jarabe, crema… |
| `laboratorio` | `text` | Opcional |
| `cantidad_envases` | `int` | `NOT NULL DEFAULT 1`, `CHECK (cantidad_envases >= 0)` |
| `foto_path` | `text` | Opcional, ruta en el bucket `fotos` |
| `creado_en`, `actualizado_en` | `timestamptz` | `actualizado_en` lo mantiene un trigger |
| `actualizado_por` | `uuid` → `auth.users` | Lo asigna un trigger con `auth.uid()` |
| `actualizado_por_email` | `text` | Lo asigna el mismo trigger, con el correo del JWT; se muestra en "Último cambio" |

**Restricciones e índices**
- Función `normalizar(text)`: envoltorio `IMMUTABLE` de `lower(unaccent(trim(...)))`. Es
  necesaria porque `unaccent` no es inmutable y Postgres no la acepta directamente en índices.
- Índice único sobre `(normalizar(nombre_comercial), normalizar(coalesce(dosis,'')))`
  para evitar duplicados.

**Reglas de negocio**
- Un medicamento con `cantidad_envases = 0` **no se borra**: se muestra como "Sin stock"
  y sigue apareciendo en las búsquedas. Eliminarlo es una acción explícita.
- Registrar un medicamento que ya existe (mismo nombre comercial y dosis normalizados)
  se convierte en una propuesta de "sumar". No se ofrece "guardar como nuevo", porque el
  índice único lo impediría; si es otro producto, el usuario corrige el nombre o la dosis.
- El trigger guarda `nombre_comercial` sin espacios sobrantes y `principios_activos`
  normalizados (minúsculas, sin vacíos ni repetidos; se conservan las tildes
  para mostrarlos, y las comparaciones usan `normalizar`).

### Funciones SQL (RPC)
- `ajustar_envases(id uuid, delta int)`: `UPDATE … SET cantidad_envases = cantidad_envases + delta`
  en una sola sentencia, con piso en 0, y devuelve la fila. Evita perder cambios concurrentes.
- `registrar_uso_ia(p_limite int) returns boolean`: suma 1 al uso del día del usuario actual
  en `uso_ia` de forma atómica y devuelve si sigue dentro del límite. Es `SECURITY DEFINER`;
  `uso_ia` no es accesible directamente.

### Seguridad (RLS)
- `medicamentos` tiene RLS activado, con una única política: el rol `authenticated` puede
  ejecutar `SELECT/INSERT/UPDATE/DELETE`. El rol `anon` no tiene acceso.
- El bucket `fotos` es privado y la misma regla aplica a sus objetos.
- El registro público está desactivado en Supabase Auth; el administrador crea las cuentas.

## 5. Lectura de fotos con IA

### Edge Function `analizar-foto`
- **Entrada:** imagen JPEG reducida en el teléfono (lado mayor de aproximadamente 1000 px,
  calidad de alrededor de 0,7).
- **Validaciones:** JWT válido y límite diario por usuario (100 análisis/día, contados en
  la tabla `uso_ia(usuario, fecha, cantidad)`).
- **Modelo:** `claude-haiku-5-5`, con salida estructurada (`output_config.format` con un
  esquema JSON).
- **Salida:**

```json
{
  "legible": true,
  "es_medicamento": true,
  "nombre_comercial": "Kitadol",
  "principios_activos": ["paracetamol"],
  "dosis": "500 mg",
  "forma": "comprimidos",
  "laboratorio": "Laboratorio Chile"
}
```

- **Instrucciones clave para el modelo:** devolver los principios activos con su nombre
  genérico (DCI) en español y en minúsculas, por ejemplo "paracetamol" y no "acetaminofén";
  dejar en `null` lo que no se lea con seguridad, sin inventar; marcar `legible: false` o
  `es_medicamento: false` cuando corresponda.
- **Tiempo de espera:** unos 20 s, con un reintento ante errores transitorios (429/5xx).
- **Costo estimado:** unos USD 0,0003 por foto. La API funciona con crédito prepagado y
  no tiene plan gratuito.

## 6. Búsqueda

### Por texto
`buscarPorTexto()` del módulo `dominio` busca a la vez en el nombre comercial y en los
principios activos de la lista descargada, sin distinguir tildes ni mayúsculas y tolerando
un error de tipeo por palabra (en palabras de 5 letras o más). Primero aparecen los
resultados con stock y al final los "Sin stock". Funciona igual sin conexión, sobre la caché.

### Por foto
1. La foto se analiza con `analizar-foto` y **no se guarda**.
2. `clasificarResultado()` del módulo `dominio` compara la extracción con el inventario descargado:
   - ✅ **Ya lo tienes:** mismo nombre comercial normalizado, misma dosis y **con stock**.
   - 🔁 **Tienes un equivalente:** otro medicamento **con stock** con el mismo **conjunto** de
     principios activos (el orden no importa). Si la dosis es distinta, se indica (por
     ejemplo, "tú buscas 1 g").
   - ❌ **No lo tienes:** ninguna de las anteriores. Si el mismo producto existe pero está
     "Sin stock", se indica ("Lo tenían, pero se acabó").
3. Desde cualquier resultado, el botón **"Lo compré · registrar"** abre el formulario de
   registro con los datos ya extraídos.

**Normalización de la dosis:** se comparan valor y unidad después de convertir
`g ↔ mg ↔ mcg` y `l ↔ ml` (por ejemplo, "1 g" = "1000 mg"). Si no se puede interpretar,
se compara el texto normalizado. Si uno de los dos no tiene dosis, se consideran compatibles.

## 7. Pantallas y flujo

Referencia visual: `docs/mockups/`.

0. **Inicio de sesión:** solo la primera vez. La sesión persiste en el teléfono
   (AsyncStorage, como indica la guía oficial de Supabase para Expo) y se renueva
   automáticamente.
1. **Inventario (principal):** buscador de texto, botón de cámara para buscar por foto,
   filtros *Todos / Con stock / Sin stock*, lista con miniatura, nombre, principios
   activos, cantidad y botones −/+ (bajar de 1 a 0 pide confirmación), indicador de
   sincronización y un botón flotante **Registrar**.
2. **Cámara:** compartida por el registro y la búsqueda, con un marco de encuadre.
3. **Registrar:** formulario prellenado por la IA y editable, con chips para los principios
   activos (separados por comas) y cantidad de envases. Si hay un duplicado, propone
   "Sumar N envases" o volver a editar los datos.
4. **Resultado de la búsqueda por foto:** tarjeta verde, ámbar o roja, más el botón
   "Lo compré · registrar".
5. **Detalle:** foto grande, todos los datos, −/+, editar, quién y cuándo hizo el último
   cambio, y eliminar (con confirmación).

## 8. Manejo de errores

| Situación | Comportamiento |
|---|---|
| Foto ilegible o que no es un medicamento | "No pude leer la caja", con las opciones **Reintentar foto** y **Escribir a mano** |
| Extracción parcial | Los campos faltantes quedan vacíos y editables. `nombre_comercial` es obligatorio. Sin principio activo, se avisa que no habrá equivalentes, pero se permite guardar |
| Sin conexión | Inventario en solo lectura desde la caché local (AsyncStorage), con el aviso "Sin conexión · datos de hace X min". El registro, la edición y la búsqueda por foto se deshabilitan |
| IA lenta o con error | Tiempo de espera de unos 20 s y un reintento; si sigue fallando, se ofrece "Escribir a mano" |
| Límite diario de IA alcanzado | Mensaje claro, con la opción de registrar o buscar escribiendo |
| Falla la subida de la foto | Se guarda el medicamento sin foto |
| Cambios concurrentes de cantidad | `ajustar_envases` es atómico y no baja de 0 |
| Registros duplicados simultáneos | El índice único rechaza el segundo y la app muestra la propuesta "Sumar 1" |
| Acceso sin sesión | RLS deniega el acceso y la Edge Function responde 401 |

## 9. Pruebas

1. **Unitarias (Jest), módulo `dominio`:** normalización de tildes y mayúsculas,
   normalización de la dosis (`g ↔ mg`), `buscarPorTexto` (tildes, errores de tipeo, orden),
   `buscarDuplicado`, y `clasificarResultado` en sus tres casos, incluidas combinaciones de
   principios activos, diferencias de dosis y productos sin stock.
2. **Base de datos (pgTAP con Supabase local; requiere Docker, que hay que instalar):**
   `anon` no puede leer ni escribir; `ajustar_envases` es una sola sentencia atómica y
   respeta el piso en 0; el índice único impide duplicados aunque cambien mayúsculas,
   tildes o espacios; el trigger normaliza los datos; `registrar_uso_ia` respeta el límite.
3. **Edge Function:** pruebas con Claude simulado (formato de salida, validación del
   esquema, 401 sin sesión, límite diario). Además, una **evaluación con 15 a 20 fotos
   reales** de cajas chilenas, en la que se mide el acierto en nombre comercial, principio
   activo y dosis. Esta evaluación se ejecuta manualmente porque consume crédito.
4. **Manual, en Android con Expo Go:** iniciar sesión, registrar, sumar y restar, buscar
   por texto y por foto, usar modo avión (caché) y comprobar la sincronización en vivo con
   un segundo teléfono.

## 10. Stack y costos

| Pieza | Tecnología | Costo |
|---|---|---|
| App | Expo SDK (React Native) + TypeScript + Expo Router | Gratis |
| Compilación del APK | EAS Build (nube) | Plan gratuito |
| Backend | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) | Plan gratuito |
| IA | Claude Haiku 5.5 (USD 0,10 / 0,50 por millón de tokens de entrada / salida) | ~USD 0,0003 por foto |
| Pruebas | Jest, Deno test, Supabase CLI + Docker (pgTAP) | Gratis |

## 11. Riesgos y preguntas abiertas

- **Calidad de la lectura de cajas chilenas:** se medirá con la evaluación de fotos
  reales antes de dar por terminada la v1. Si el acierto es bajo, se puede ajustar el
  prompt o subir a un modelo más capaz.
- **Sinónimos de principios activos** (por ejemplo, paracetamol y acetaminofén): se
  mitiga con la instrucción de usar la DCI en español; si aparecen casos, se añadirá una
  pequeña tabla de sinónimos en `dominio`.
- **Plan gratuito de Supabase:** los proyectos inactivos se pausan tras un periodo sin
  uso. Para una familia con uso esporádico conviene saberlo; se reactivan desde el panel.
