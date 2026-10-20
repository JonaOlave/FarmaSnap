export const MODELO = "claude-haiku-5-5";
export const LIMITE_DIARIO = 100;

const textoONulo = { anyOf: [{ type: "string" }, { type: "null" }] };

export const ESQUEMA = {
  type: "object",
  properties: {
    legible: { type: "boolean" },
    es_medicamento: { type: "boolean" },
    nombre_comercial: textoONulo,
    principios_activos: { type: "array", items: { type: "string" } },
    dosis: textoONulo,
    forma: textoONulo,
    laboratorio: textoONulo,
  },
  required: [
    "legible",
    "es_medicamento",
    "nombre_comercial",
    "principios_activos",
    "dosis",
    "forma",
    "laboratorio",
  ],
  additionalProperties: false,
} as const;

export const INSTRUCCIONES = `Lees fotos de cajas de medicamentos vendidos en Chile y extraes sus datos.

Reglas:
- nombre_comercial: la marca tal como aparece en la caja (por ejemplo "Kitadol", "Tapsin Día"). Si el producto se vende por su nombre genérico, usa ese nombre (por ejemplo "Paracetamol").
- principios_activos: cada principio activo con su nombre genérico (DCI) en español y en minúsculas, por ejemplo "paracetamol", nunca "acetaminofén" ni "Paracetamol 500 mg". Sin la sal ni el hidrato: "fenoterol", no "bromhidrato de fenoterol"; "diclofenaco", no "diclofenaco sódico". Si hay varios, inclúyelos todos.
- dosis: la concentración principal como aparece, por ejemplo "500 mg", "1 g", "100 mg/5 ml".
- forma: comprimidos, cápsulas, jarabe, gotas, crema, suspensión, etc., en minúsculas.
- laboratorio: el fabricante si aparece.
- Si un dato no se lee con seguridad, devuelve null. Nunca inventes datos.
- legible: false si la foto está borrosa, cortada o no permite leer el nombre.
- es_medicamento: false si la foto no muestra un medicamento.`;

export interface Extraccion {
  legible: boolean;
  es_medicamento: boolean;
  nombre_comercial: string | null;
  principios_activos: string[];
  dosis: string | null;
  forma: string | null;
  laboratorio: string | null;
}

function textoONuloDe(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const recortado = valor.replace(/\s+/g, " ").trim();
  return recortado === "" ? null : recortado;
}

export function validarExtraccion(dato: unknown): Extraccion {
  if (typeof dato !== "object" || dato === null || Array.isArray(dato)) {
    throw new Error("respuesta_invalida");
  }
  const d = dato as Record<string, unknown>;
  const nombre = textoONuloDe(d.nombre_comercial);
  const principios = Array.isArray(d.principios_activos)
    ? [
      ...new Set(
        d.principios_activos
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.replace(/\s+/g, " ").trim().toLowerCase())
          .filter((p) => p !== ""),
      ),
    ]
    : [];
  return {
    legible: d.legible === true && nombre !== null,
    es_medicamento: d.es_medicamento === true,
    nombre_comercial: nombre,
    principios_activos: principios,
    dosis: textoONuloDe(d.dosis),
    forma: textoONuloDe(d.forma)?.toLowerCase() ?? null,
    laboratorio: textoONuloDe(d.laboratorio),
  };
}

export function base64Valido(valor: unknown): valor is string {
  return typeof valor === "string" &&
    valor.length >= 100 &&
    valor.length <= 7_000_000 &&
    /^[A-Za-z0-9+/=\r\n]+$/.test(valor.slice(0, 500));
}
