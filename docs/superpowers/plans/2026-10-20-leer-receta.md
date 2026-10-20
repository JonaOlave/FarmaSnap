# Leer recetas impresas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fotografiar (o elegir de la galería) una receta impresa y ver una fila por medicamento recetado con su estado contra el inventario: En casa, Similar, Sin stock o No registrado.

**Architecture:** La Edge Function `analizar-foto` acepta `tipo: "caja" | "receta"` (ausente = caja) y para receta usa instrucciones y esquema propios que devuelven una lista. La app clasifica cada ítem con una función pura nueva (`clasificarReceta`) que reutiliza `clasificarResultado`, y la pantalla `buscar-foto` gana un selector Caja | Receta y una vista de lista.

**Tech Stack:** Deno + `@anthropic-ai/sdk` (Edge Function), Expo SDK 58 / React Native / TypeScript 6 strict, jest-expo, deno test.

**Spec:** `docs/superpowers/specs/2026-10-20-leer-receta-design.md`

## Global Constraints

- La búsqueda por receta **no modifica el stock** ni guarda la foto ni datos de la receta (ni Storage, ni base, ni caché, ni logs).
- Petición sin `tipo` → se trata como `"caja"` (los APK instalados siguen funcionando).
- Receta consume **un** uso del límite diario (`registrar_uso_ia`), igual que caja.
- Modelo: `MODELO` existente (`claude-haiku-5-5`); sin cambios en la base de datos.
- Principios activos: DCI en español, minúsculas, sin sal; los deducidos de una marca van con `principios_deducidos: true`.
- Textos de la UI en español de Chile, tuteo, como el resto de la app.
- Fotos de recetas nunca se versionan (`eval/fotos/` ya está en `.gitignore`).
- Comandos: app → `cd mobile && npm run typecheck && npx jest`; función → `cd supabase/functions/analizar-foto && deno test`.

## Review Focus

1. **Medicamento repetido en la receta** (la IA lo lista dos veces) → aparece una sola fila. Test en Task 1 (`validarReceta` deduplica por nombre normalizado).
2. **Ítem sin nombre o con nombre vacío** devuelto por la IA → se descarta, no aparece fila vacía. Test en Task 1.
3. **Receta solo con marca y sin principios** que no está en el inventario → "No registrado", nunca "Similar" por un conjunto vacío. Test en Task 2.
4. **Mismo nombre, otra dosis, sin principios** ("Kitadol 1 g" vs "Kitadol 500 mg" con stock) → Similar. Test en Task 2.
5. **`tipo` desconocido** (`"otro"`) → 400 `tipo_invalido`, sin consumir uso. Test en Task 1.

---

### Task 1: Edge Function — modo receta

**Files:**
- Modify: `supabase/functions/analizar-foto/logica.ts`, `claude.ts`, `handler.ts`, `index.ts`
- Test: `supabase/functions/analizar-foto/logica.test.ts`, `claude.test.ts`, `handler.test.ts`

**Interfaces:**
- Produces (logica.ts):
  ```ts
  export interface MedicamentoRecetado {
    nombre: string;
    principios_activos: string[];
    principios_deducidos: boolean;
    dosis: string | null;
    forma: string | null;
  }
  export interface ExtraccionReceta { es_receta: boolean; medicamentos: MedicamentoRecetado[] }
  export const ESQUEMA_RECETA; export const INSTRUCCIONES_RECETA: string;
  export function validarReceta(dato: unknown): ExtraccionReceta;
  ```
- Produces (claude.ts): `extraerReceta(cliente: ClienteMensajes, imagenBase64: string): Promise<ExtraccionReceta>`
- Produces (handler.ts): `Dependencias.extraerReceta(imagenBase64: string): Promise<ExtraccionReceta>`; body `{ imagen_base64, tipo?: "caja" | "receta" }`.

- [ ] **Step 1: Tests de `validarReceta` y `ESQUEMA_RECETA` (logica.test.ts)**

  - `validarReceta recorta, normaliza y descarta ítems sin nombre`: entrada `{ es_receta: true, medicamentos: [{ nombre: " Fesema ", principios_activos: ["Salbutamol"], principios_deducidos: true, dosis: null, forma: "Inhalador" }, { nombre: "  ", principios_activos: [], principios_deducidos: false, dosis: null, forma: null }] }` → `{ es_receta: true, medicamentos: [{ nombre: "Fesema", principios_activos: ["salbutamol"], principios_deducidos: true, dosis: null, forma: "inhalador" }] }`.
  - `validarReceta deduplica por nombre normalizado`: `"Coritex forte"` y `"CORITEX FORTE"` → una sola entrada (la primera).
  - `validarReceta exige principios para marcar deducidos`: `principios_activos: []` con `principios_deducidos: true` → `principios_deducidos: false`.
  - `validarReceta con es_receta false devuelve lista vacía`, y `assertThrows` con `null`, `[]` y `"x"`.
  - `ESQUEMA_RECETA` y su `items` tienen `additionalProperties: false` y `required` = todas sus propiedades (igual que el test existente de `ESQUEMA`).

- [ ] **Step 2: `deno test` → FAIL (exports no existen)**

- [ ] **Step 3: Implementar en logica.ts**

  `validarReceta` reutiliza `textoONuloDe` y la misma limpieza de principios que `validarExtraccion` (extraer esa limpieza a una función `limpiarPrincipios(valor: unknown): string[]` usada por ambas). Dedupe con clave `nombre.toLowerCase()` sin tildes (`normalize("NFD").replace(/[̀-ͯ]/g, "")`).

  `INSTRUCCIONES_RECETA` (texto fijo):
  ```
  Lees fotos de recetas médicas impresas de Chile y listas los medicamentos recetados.

  Reglas:
  - medicamentos: cada medicamento recetado, en el orden de la receta. Ignora indicaciones, posología, duración, diagnóstico y los datos del paciente, del médico y de la clínica.
  - Ignora recomendaciones sin un producto concreto (por ejemplo "tomar probióticos").
  - nombre: como está escrito en la receta (marca o genérico), sin la dosis ni la forma. Por ejemplo "Ibuprofeno forte", "Berodual", "Azitromicina".
  - principios_activos: cada principio activo con su nombre genérico (DCI) en español, en minúsculas y sin la sal. Si la receta ya dice el genérico, úsalo. Si solo trae la marca y conoces con seguridad su composición en Chile, inclúyela y marca principios_deducidos: true; si no la conoces con seguridad, deja la lista vacía. Nunca inventes.
  - dosis: la concentración si aparece, por ejemplo "500 mg", "200 mg/5 ml", "200 µg"; si no, null.
  - forma: comprimidos, cápsulas, jarabe, suspensión, gotas, inhalador, crema, etc., en minúsculas. Si no está escrita, dedúcela de la indicación ("gotas" → gotas, "puff" → inhalador, "ml" → jarabe o suspensión); si no se puede, null.
  - La hoja puede estar girada o con sombras; léela igual.
  - es_receta: false si la foto no es una receta médica.
  ```

- [ ] **Step 4: `deno test` → PASS**

- [ ] **Step 5: Test de `extraerReceta` (claude.test.ts)**

  `extraerReceta envía la imagen con las instrucciones y el esquema de receta`: con el `clienteFalso` existente y un JSON válido de receta, assert `p.system === INSTRUCCIONES_RECETA`, `p.output_config.format.schema === ESQUEMA_RECETA`, `p.model === MODELO`, la imagen enviada es `"QUJD"`, y el resultado pasó por `validarReceta` (principio en minúsculas). Más: `refusal`/`max_tokens` → `ErrorExtraccion`.

- [ ] **Step 6: Run → FAIL; implementar `extraerReceta`**

  Generalizar el cuerpo actual de `extraerDeImagen` en una función privada `pedir(cliente, imagen, system, schema, texto)` que devuelve el JSON parseado; `extraerDeImagen` y `extraerReceta` la llaman con su validador. Texto del usuario para receta: `"Lista los medicamentos de esta receta."`. Mismo `max_tokens: 4000` y `effort: "low"`.

- [ ] **Step 7: Run → PASS**

- [ ] **Step 8: Tests del handler (handler.test.ts)**

  Agregar `extraerReceta` a `deps()` (resuelve una `ExtraccionReceta` fija `receta`).
  - `sin tipo usa extraer (caja)`: cuerpo `{ imagen_base64 }` → 200 y cuerpo = `extraccion` (el test existente ya lo cubre; asegurar que `extraerReceta` no se llamó).
  - `tipo receta usa extraerReceta`: `{ imagen_base64, tipo: "receta" }` → 200, cuerpo = `receta`, `extraer` no llamado.
  - `tipo caja explícito usa extraer`.
  - `tipo inválido → 400 tipo_invalido sin registrar uso`: `{ imagen_base64, tipo: "otro" }` → `{ error: "tipo_invalido" }`; contador de `registrarUso` en 0.
  - `receta registra un uso`: contador = 1.
  - `fallo de extraerReceta → 502 ia_no_disponible`.

- [ ] **Step 9: Run → FAIL; implementar en handler.ts**

  Leer `tipo` del cuerpo; `undefined` → `"caja"`; distinto de `"caja"`/`"receta"` → 400 `tipo_invalido`. Validar `tipo` **antes** de `registrarUso`. Elegir `deps.extraer` o `deps.extraerReceta`. Wiring en `index.ts`: `extraerReceta: (imagen) => extraerReceta(anthropic as unknown as ClienteMensajes, imagen)`. No agregar ningún `console.log` del resultado.

- [ ] **Step 10: `deno test` → todos PASS; `deno check index.ts eval.ts` → sin errores**

- [ ] **Step 11: Commit**

  ```bash
  git add supabase/functions/analizar-foto
  git commit -m "feat(ia): modo receta en analizar-foto con lista de medicamentos"
  ```

  El despliegue (`npx supabase functions deploy analizar-foto`) se hace en Task 4, cuando la app ya lo use.

---

### Task 2: App — clasificar una receta contra el inventario

**Files:**
- Modify: `mobile/src/dominio/tipos.ts`
- Create: `mobile/src/dominio/receta.ts`
- Test: `mobile/src/dominio/__tests__/receta.test.ts`

**Interfaces:**
- Consumes: `clasificarResultado` (`src/dominio/clasificar.ts`), `mismaDosis`, `normalizar`.
- Produces (tipos.ts): `MedicamentoRecetado` y `ExtraccionReceta` con la misma forma que Task 1, y
  ```ts
  export type EstadoReceta =
    | { tipo: 'en_casa'; medicamento: Medicamento }
    | { tipo: 'similar'; coincidencias: CoincidenciaEquivalente[] }   // máx. 3
    | { tipo: 'sin_stock'; medicamento: Medicamento }
    | { tipo: 'no_registrado' };
  export interface FilaReceta { recetado: MedicamentoRecetado; estado: EstadoReceta }
  ```
- Produces (receta.ts): `clasificarReceta(recetados: MedicamentoRecetado[], inventario: Medicamento[]): FilaReceta[]` (mismo orden que la entrada).

- [ ] **Step 1: Tests (receta.test.ts)** — usar el helper `med` como en `clasificar.test.ts`. Inventario: Kitadol 500 mg (2), Ibuprofeno 400 mg ['ibuprofeno'] (1), Loratadina 10 mg ['loratadina'] (0), Berodual ['fenoterol','ipratropio'] (1).
  - `en casa`: `{ nombre: 'Berodual', principios_activos: [], dosis: null }` → `en_casa` con Berodual.
  - `similar por principio`: `Ibuprofeno forte`, `['ibuprofeno']`, `200 mg/5 ml` → `similar`, coincidencia Ibuprofeno 400 mg con `dosisDistinta: true`.
  - `similar por mismo nombre y otra dosis sin principios`: `Kitadol`, `[]`, `1 g` → `similar` con Kitadol 500 mg, `dosisDistinta: true`.
  - `sin stock`: `Loratadina`, `['loratadina']`, `10 mg` → `sin_stock` con Loratadina.
  - `no registrado sin principios`: `Fesema`, `[]`, `null` → `no_registrado`.
  - `no registrado con principios desconocidos`: `Coritex forte`, `['clorfenamina']` → `no_registrado`.
  - `similar se limita a 3 coincidencias`: 5 medicamentos con `['paracetamol']` y stock, recetado `Panadol` `['paracetamol']` → 3 coincidencias.
  - `mantiene el orden de la receta` con 3 ítems.

- [ ] **Step 2: `npx jest src/dominio/__tests__/receta.test.ts` → FAIL (módulo no existe)**

- [ ] **Step 3: Implementar `clasificarReceta`**

  Por ítem: `r = clasificarResultado({ nombre_comercial: nombre, principios_activos, dosis }, inventario)`. `tiene` → `en_casa`; `equivalente` → `similar` con `coincidencias.slice(0, 3)`; `no_tiene` → primero buscar en el inventario uno con stock y mismo `normalizar(nombre_comercial)` (dosis distinta) → `similar` con `[{ medicamento, dosisDistinta: !mismaDosis(m.dosis, dosis) }]`; si no, `agotado` → `sin_stock`; si no, `no_registrado`.

- [ ] **Step 4: Run → PASS; `npm run typecheck` sin errores**

- [ ] **Step 5: Commit** — `feat(app): clasificar los medicamentos de una receta contra el inventario`

---

### Task 3: App — enviar la receta y elegir la resolución

**Files:**
- Modify: `mobile/src/datos/analizarFoto.ts`, `mobile/src/datos/imagen.ts`, `mobile/src/datos/dimensiones.ts`
- Test: `mobile/src/datos/__tests__/dimensiones.test.ts`, `mobile/src/datos/__tests__/analizarFoto.test.ts` (nuevo)

**Interfaces:**
- Produces:
  - `export const LADO_CAJA = 1000; export const LADO_RECETA = 1568;` en `dimensiones.ts` (1568 px = lado mayor que la API de Claude usa sin reducir; `dimensionesDestino` sigue con `maximo = LADO_CAJA` por defecto).
  - `prepararFoto(uri: string, ancho: number, alto: number, maximo = LADO_CAJA): Promise<FotoPreparada>`
  - `analizarReceta(imagenBase64: string, limiteMs = 60_000): Promise<ExtraccionReceta>` en `analizarFoto.ts`.

- [ ] **Step 1: Tests**
  - dimensiones: `dimensionesDestino(3000, 4000, LADO_RECETA)` → `{ height: 1568 }`.
  - analizarFoto.test.ts (mock de `../supabase` con `jest.mock`, `functions.invoke` como `jest.fn`):
    - `analizarReceta envía tipo receta`: invoke llamado con `('analizar-foto', { body: { imagen_base64: 'QUJD', tipo: 'receta' } })` y devuelve `data`.
    - `analizarFoto no envía tipo`: body exactamente `{ imagen_base64: 'QUJD' }`.
    - `analizarReceta propaga el error de invoke` (rechaza con el mismo error).

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implementar** — extraer la carrera con el temporizador a una función privada `invocar<T>(body: object, limiteMs: number): Promise<T>` usada por `analizarFoto` y `analizarReceta`; `prepararFoto` pasa `maximo` a `dimensionesDestino`.

- [ ] **Step 4: Run → PASS (suite completa) y typecheck**

- [ ] **Step 5: Commit** — `feat(app): enviar recetas a la IA con mayor resolución`

---

### Task 4: App — selector Caja | Receta y lista de resultados

**Files:**
- Modify: `mobile/src/ui/CapturaFoto.tsx`, `mobile/app/buscar-foto.tsx`, `docs/pruebas-manuales.md`
- Create: `mobile/src/ui/ResultadoReceta.tsx`

**Interfaces:**
- Consumes: `clasificarReceta` (Task 2), `analizarReceta`, `LADO_RECETA`, `prepararFoto(…, maximo)` (Task 3).
- Produces: `CapturaFoto` props nuevas `maximo?: number` (se pasa a `prepararFoto` en cámara y galería), `marco?: 'caja' | 'hoja'` (default `'caja'`; `'hoja'` = `top: '12%'`, `left: '8%'`, `right: '8%'`, `height: '62%'`) y `superior?: ReactNode` (se dibuja bajo la indicación). `ResultadoReceta({ filas: FilaReceta[]; onAbrir: (id: string) => void })`.

- [ ] **Step 1: `CapturaFoto`** — agregar las tres props; sin cambio de comportamiento con los defaults (registrar.tsx no se toca).

- [ ] **Step 2: `ResultadoReceta`** — encabezado `Receta · {n} medicamento(s)`; una tarjeta por fila con el nombre recetado + dosis y:
  - `en_casa` (colores ok): "✓ En casa · {textoCantidad}"; toca → detalle.
  - `similar` (colores eq): "≈ Similar en casa"; por coincidencia "{nombre dosis}: {textoCantidad}" (toca → detalle) y "⚠ Dosis distinta" si aplica; si `recetado.principios_deducidos`, línea "Según la IA contiene {principios.join(' + ')}".
  - `sin_stock` (colores no): "Registrado, sin stock"; toca → detalle.
  - `no_registrado` (fondo blanco, borde `colores.linea`, texto `colores.suave`): "No registrado" y los principios si hay.

- [ ] **Step 3: `buscar-foto.tsx`** — estado `modo: 'caja' | 'receta'` (inicial `'caja'`); en la cámara, `superior` = selector de dos chips "Caja" / "Receta" (estilo como los chips del inventario, sobre fondo oscuro); con receta: `indicacion="Fotografía la receta completa"`, `marco="hoja"`, `maximo={LADO_RECETA}`. Al capturar en receta: `analizarReceta` → si `!es_receta || medicamentos.length === 0` → error "No encontré medicamentos en la receta. Prueba con más luz y la hoja completa."; si no, paso `{ tipo: 'receta', filas: clasificarReceta(e.medicamentos, medicamentos) }`. Texto de carga en receta: "Leyendo la receta…". Resultado: `ResultadoReceta` + botones "Escanear otra receta" (vuelve a cámara en modo receta) y "Volver" (`router.back()`). Sin "Lo compré · registrar" y sin guardar nada. Errores de red/límite: `mensajeErrorAnalisis` como hoy. Reintentar conserva el modo.

- [ ] **Step 4: `npm run typecheck && npx jest` → sin errores, suite verde**

- [ ] **Step 5: `docs/pruebas-manuales.md`** — sección "Receta": las dos recetas de ejemplo listan todos sus medicamentos y nada más; cada estado aparece con el color correcto; "Según la IA contiene…" en una marca deducida; el stock no cambia tras buscar; una foto que no es receta muestra el mensaje; un APK antiguo sigue buscando cajas.

- [ ] **Step 6: Desplegar la función** — `npx supabase functions deploy analizar-foto` → "Deployed Functions.".

- [ ] **Step 7: Commit** — `feat(app): búsqueda por receta con lista de medicamentos y su estado`

- [ ] **Step 8: Prueba en el teléfono** — el usuario fotografía las dos recetas (Expo Go o APK nuevo con `npx eas-cli build -p android --profile preview`); ajustar `INSTRUCCIONES_RECETA` si falta o sobra algún medicamento, con test que lo fije si es lógica de validación.
