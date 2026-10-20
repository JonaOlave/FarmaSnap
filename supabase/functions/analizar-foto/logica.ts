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

function limpiarPrincipios(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return [
    ...new Set(
      valor
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.replace(/\s+/g, " ").trim().toLowerCase())
        .filter((p) => p !== ""),
    ),
  ];
}

export function validarExtraccion(dato: unknown): Extraccion {
  if (typeof dato !== "object" || dato === null || Array.isArray(dato)) {
    throw new Error("respuesta_invalida");
  }
  const d = dato as Record<string, unknown>;
  const nombre = textoONuloDe(d.nombre_comercial);
  const principios = limpiarPrincipios(d.principios_activos);
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

export const ESQUEMA_RECETA = {
  type: "object",
  properties: {
    es_receta: { type: "boolean" },
    medicamentos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          principios_activos: { type: "array", items: { type: "string" } },
          principios_deducidos: { type: "boolean" },
          dosis: textoONulo,
          forma: textoONulo,
        },
        required: ["nombre", "principios_activos", "principios_deducidos", "dosis", "forma"],
        additionalProperties: false,
      },
    },
  },
  required: ["es_receta", "medicamentos"],
  additionalProperties: false,
} as const;

export const INSTRUCCIONES_RECETA = `Lees fotos de recetas médicas impresas de Chile y listas los medicamentos recetados.

Reglas:
- medicamentos: cada medicamento recetado, en el orden de la receta. Ignora indicaciones, posología, duración, diagnóstico y los datos del paciente, del médico y de la clínica.
- Ignora recomendaciones sin un producto concreto (por ejemplo "tomar probióticos").
- nombre: como está escrito en la receta (marca o genérico), sin la dosis ni la forma. Por ejemplo "Ibuprofeno forte", "Berodual", "Azitromicina".
- principios_activos: cada principio activo con su nombre genérico (DCI) en español, en minúsculas y sin la sal. Si la receta ya dice el genérico, úsalo. Si solo trae la marca y conoces con seguridad su composición en Chile, inclúyela y marca principios_deducidos: true; si no la conoces con seguridad, deja la lista vacía. Nunca inventes.
- dosis: la concentración si aparece, por ejemplo "500 mg", "200 mg/5 ml", "200 µg"; si no, null.
- forma: comprimidos, cápsulas, jarabe, suspensión, gotas, inhalador, crema, etc., en minúsculas. Si no está escrita, dedúcela de la indicación ("gotas" → gotas, "puff" → inhalador, "ml" → jarabe o suspensión); si no se puede, null.
- La hoja puede estar girada o con sombras; léela igual.
- es_receta: false si la foto no es una receta médica.`;

export interface MedicamentoRecetado {
  nombre: string;
  principios_activos: string[];
  principios_deducidos: boolean;
  dosis: string | null;
  forma: string | null;
}

export interface ExtraccionReceta {
  es_receta: boolean;
  medicamentos: MedicamentoRecetado[];
}

function claveNombre(nombre: string): string {
  return nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function validarReceta(dato: unknown): ExtraccionReceta {
  if (typeof dato !== "object" || dato === null || Array.isArray(dato)) {
    throw new Error("respuesta_invalida");
  }
  const d = dato as Record<string, unknown>;
  if (d.es_receta !== true) return { es_receta: false, medicamentos: [] };
  const medicamentos: MedicamentoRecetado[] = [];
  // Repetido: mismo nombre y misma dosis, o mismo nombre y a uno de los dos le falta la dosis.
  const repetido = (nombre: string, dosis: string | null) =>
    medicamentos.some((m) =>
      claveNombre(m.nombre) === claveNombre(nombre) &&
      (m.dosis === null || dosis === null || claveNombre(m.dosis) === claveNombre(dosis))
    );
  for (const item of Array.isArray(d.medicamentos) ? d.medicamentos : []) {
    if (typeof item !== "object" || item === null) continue;
    const m = item as Record<string, unknown>;
    const nombre = textoONuloDe(m.nombre);
    const dosis = textoONuloDe(m.dosis);
    if (nombre === null || repetido(nombre, dosis)) continue;
    const principios = limpiarPrincipios(m.principios_activos);
    medicamentos.push({
      nombre,
      principios_activos: principios,
      principios_deducidos: m.principios_deducidos === true && principios.length > 0,
      dosis,
      forma: textoONuloDe(m.forma)?.toLowerCase() ?? null,
    });
  }
  return { es_receta: true, medicamentos };
}
