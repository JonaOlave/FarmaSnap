export interface DatosMedicamento {
  nombre_comercial: string;
  principios_activos: string[];
  dosis: string | null;
  forma: string | null;
  laboratorio: string | null;
}

export interface Medicamento extends DatosMedicamento {
  id: string;
  cantidad_envases: number;
  foto_path: string | null;
  creado_en: string;
  actualizado_en: string;
  actualizado_por_email: string | null;
}

export interface ValoresFormulario extends DatosMedicamento {
  cantidad_envases: number;
}

/** Respuesta de la Edge Function `analizar-foto`. */
export interface Extraccion {
  legible: boolean;
  es_medicamento: boolean;
  nombre_comercial: string | null;
  principios_activos: string[];
  dosis: string | null;
  forma: string | null;
  laboratorio: string | null;
}

export interface CoincidenciaEquivalente {
  medicamento: Medicamento;
  dosisDistinta: boolean;
}

export type ResultadoBusqueda =
  | { tipo: 'tiene'; medicamento: Medicamento }
  | { tipo: 'equivalente'; coincidencias: CoincidenciaEquivalente[] }
  | { tipo: 'no_tiene'; agotado: Medicamento | null };
