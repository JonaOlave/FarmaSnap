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

/** Un medicamento leído de una receta (respuesta de `analizar-foto` con tipo receta). */
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

export type EstadoReceta =
  | { tipo: 'en_casa'; medicamento: Medicamento }
  | { tipo: 'similar'; coincidencias: CoincidenciaEquivalente[] }
  | { tipo: 'sin_stock'; medicamento: Medicamento }
  | { tipo: 'no_registrado' };

export interface FilaReceta {
  recetado: MedicamentoRecetado;
  estado: EstadoReceta;
}
