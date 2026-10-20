# FarmaSnap — Leer recetas impresas

**Fecha:** 2026-10-20
**Base:** extiende `docs/superpowers/specs/2026-10-18-farmasnap-design.md` (v1). Todo lo que este documento no cambia sigue igual.

## 1. Propósito

Con una receta médica impresa en la mano, la familia quiere saber **en pocos segundos qué medicamentos recetados hay en casa con stock** y cuáles faltan. Lo que falta, lo compran. La búsqueda por receta es **solo una consulta: no modifica el stock** ni guarda nada.

Hoy la búsqueda por foto falla con recetas: la IA está instruida para leer *una caja* y devolver *un* medicamento, la foto se reduce a 1000 px (poco para la letra de una hoja) y la pantalla de resultado muestra un solo medicamento.

### Criterios de éxito
- Con las dos recetas de ejemplo (formatos de abajo), la app lista **todos** los medicamentos recetados y ningún dato extra (indicaciones, paciente, médico).
- Cada fila muestra el estado correcto contra el inventario.
- Responde en un tiempo similar al de la búsqueda por caja.

### Formatos de receta conocidos
1. **Clínica con indicaciones largas:** cada medicamento empieza con una línea `NOMBRE, FORMA DOSIS` (p. ej. "BUDESONIDA, INHALADOR 200 UG", "AZITROMICINA, COMPRIMIDOS 500 MG", "BERODUAL, INHALADOR", "ACEMUK, JARABE") seguida de varias líneas de indicaciones. Mezcla genéricos y marcas. Puede incluir recomendaciones sin producto ("tomar probióticos"). La foto puede venir girada 90°.
2. **"Recetas solicitadas" (formato prioritario, indicado por el usuario):** nombre en negrita y una línea de indicación debajo ("Coritex forte" / "11 gotas cada 12 hrs. durante 5 dias"; "Fesema" / "2 puff cada 6 hrs…"; "Ibuprofeno forte ( 200 mg/ 5ml)" / "3 ml cada 8 hrs…"). Casi solo marcas; la forma se deduce de la indicación (gotas, puff, ml).

## 2. Alcance

**Incluido**
- Elegir "Receta" en la búsqueda por foto (cámara o galería).
- Lectura de la receta con IA: lista de medicamentos con nombre, principios activos, dosis y forma.
- Pantalla con una fila por medicamento y su estado.

**No incluido / anti-objetivos**
- Modificar el stock (ni descontar ni sumar). Ser solo consulta.
- Guardar la foto de la receta o cualquier dato de ella (ni en Storage, ni en la base, ni en caché, ni en logs).
- Leer o mostrar datos del paciente, del médico o las indicaciones.
- Lista de compras, resumen "tienes X de Y", registrar desde la receta.
- Recetas manuscritas (solo impresas).
- Inventar principios activos sin decirlo: si la IA los deduce de una marca, la app debe mostrarlo como deducido.

## 3. Experiencia

### Entrada
En la pantalla de cámara de la búsqueda por foto (`app/buscar-foto.tsx`) se agrega un selector **Caja | Receta** arriba (por defecto Caja). Con Receta, la indicación cambia a "Fotografía la receta completa" y el marco de encuadre se adapta a una hoja. El botón "Galería" funciona igual en ambos modos. *(Decisión del diseñador: un solo punto de entrada en vez de un botón nuevo en el inventario.)*

### Resultado
Encabezado: "Receta · N medicamentos". Luego una fila por medicamento detectado, en el orden de la receta:

| Estado | Cuándo | Qué muestra la fila |
|---|---|---|
| 🟢 **En casa** | Mismo producto (mismo nombre normalizado, dosis compatible) registrado con stock | Nombre y dosis recetados; envases en casa. Tocar abre el detalle. |
| 🟡 **Similar** | No está ese producto con stock, pero hay otro con stock y los mismos principios activos (otra dosis, forma o marca) | Nombre recetado y "En casa: <nombre> <dosis>" por cada coincidencia (máx. 3). Si los principios fueron deducidos por la IA, agrega "según la IA contiene <principios>". Tocar una coincidencia abre su detalle. |
| 🟠 **Sin stock** | Mismo producto registrado pero con 0 envases, y no hay similar con stock | Nombre recetado; "Registrado, sin stock". Tocar abre el detalle. |
| ⚪ **No registrado** | Nada en el inventario coincide | Nombre recetado y, si existen, principios activos. |

Botones al final: "Escanear otra receta" y "Volver".

### Errores
- La foto no es una receta / no se encontró ningún medicamento → "No encontré medicamentos en la receta. Prueba con más luz y la hoja completa." con "Reintentar".
- Resto de errores (sin conexión, límite diario, IA no disponible): los mismos mensajes que la búsqueda por caja.

## 4. Comparación con el inventario

Por cada medicamento recetado se reutiliza `clasificarResultado` (`mobile/src/dominio/clasificar.ts`) con `{ nombre_comercial, principios_activos, dosis }`, y se traduce:

- `tiene` → En casa
- `equivalente` → Similar
- `no_tiene` con `agotado` → Sin stock
- `no_tiene` sin `agotado` → No registrado

Regla adicional: si `clasificarResultado` no da `tiene` ni `equivalente`, pero hay un medicamento con stock **del mismo nombre normalizado y otra dosis**, la fila es **Similar** con ese medicamento (cubre recetas sin principios activos, p. ej. "Kitadol 1 g" con "Kitadol 500 mg" en casa).

Se mantienen sus reglas: nombre normalizado exacto + `mismaDosis` (sin dosis = compatible) para "mismo producto"; `mismosPrincipios`, que ya ignora sales (`principioBase`), para "similar". La comparación usa el inventario en memoria (`useInventario`), funciona con la caché offline pero analizar la foto requiere conexión.

## 5. Lectura con IA

### Edge Function `analizar-foto`
- El cuerpo acepta `tipo: "caja" | "receta"`. **Si falta, es `"caja"`**, para que los APK ya instalados sigan funcionando sin cambios.
- `receta` usa instrucciones y esquema propios; mismo modelo (`claude-haiku-5-5`), misma autenticación y **cuenta como un uso** del límite diario.
- Esquema de respuesta para receta:
  ```json
  {
    "es_receta": true,
    "medicamentos": [
      {
        "nombre": "Ibuprofeno forte",
        "principios_activos": ["ibuprofeno"],
        "principios_deducidos": false,
        "dosis": "200 mg/5 ml",
        "forma": "suspensión"
      }
    ]
  }
  ```
- Instrucciones (contenido mínimo):
  - Listar solo los medicamentos recetados, en orden; ignorar indicaciones, posología, diagnóstico, datos del paciente, del médico y de la clínica.
  - Ignorar recomendaciones sin producto concreto ("tomar probióticos").
  - `nombre` tal como está escrito (marca o genérico), sin la dosis.
  - `principios_activos`: DCI en español, minúsculas, sin sal. Si la receta solo trae la marca y el modelo conoce con seguridad su composición, la incluye y marca `principios_deducidos: true`; si no la conoce con seguridad, lista vacía.
  - `forma` deducida del texto o de la indicación (gotas, puff → inhalador, ml → jarabe/suspensión) si no está explícita.
  - La hoja puede estar girada.
- Validación en el servidor como `validarExtraccion`: limpiar textos, minúsculas en principios, descartar ítems sin nombre, deduplicar.
- La respuesta de la IA no se registra en logs (contiene datos de salud).

### Foto
- En modo receta la foto se envía con mayor resolución que en caja (hoy 1000 px). El valor exacto lo elige el constructor: el mayor que el modelo aprovecha sin reducirla (revisar la documentación de visión de Anthropic), respetando el límite de 7 MB de base64 de `base64Valido`.

## 6. Pruebas

- Dominio (jest): función que clasifica una lista de medicamentos recetados contra el inventario, con un caso por estado, receta sin dosis, principios deducidos y varios similares.
- Edge Function (deno test): validación del esquema de receta; `tipo` ausente → caja; `tipo` inválido → 400; receta consume un uso.
- Evaluación con las dos recetas de ejemplo: todos los medicamentos detectados y nada extra. Las fotos de recetas **no se versionan** (contienen datos personales; `eval/fotos/` ya está en `.gitignore`).
- Prueba manual en el teléfono con ambas recetas, agregada a `docs/pruebas-manuales.md`.

## 7. Decisiones del diseñador (revisables)
- Selector Caja | Receta dentro de la cámara de búsqueda, no un botón nuevo.
- Reutilizar `clasificarResultado` tal cual; sin coincidencia aproximada de nombres ("Ibuprofeno forte" no es "Ibuprofeno" por nombre, pero sí aparece como Similar por principio activo).
- Máximo 3 coincidencias por fila Similar.
- Sin cambios en la base de datos.
