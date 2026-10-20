import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

export type CodigoErrorAnalisis = 'sin_conexion' | 'limite_diario' | 'no_autorizado' | 'ia_no_disponible';

export class ErrorAnalisisFoto extends Error {
  constructor(public readonly codigo: CodigoErrorAnalisis) {
    super(codigo);
    this.name = 'ErrorAnalisisFoto';
  }
}

export function codigoDesdeError(error: unknown): CodigoErrorAnalisis {
  if (error instanceof ErrorAnalisisFoto) return error.codigo;
  if (error instanceof FunctionsFetchError) return 'sin_conexion';
  if (error instanceof FunctionsHttpError) {
    const estado = (error.context as { status?: number } | undefined)?.status;
    if (estado === 429) return 'limite_diario';
    if (estado === 401) return 'no_autorizado';
  }
  return 'ia_no_disponible';
}

const MENSAJES: Record<CodigoErrorAnalisis, string> = {
  sin_conexion: 'Sin conexión. Puedes buscar o registrar escribiendo cuando vuelva internet.',
  limite_diario: 'Se alcanzó el límite diario de fotos. Puedes escribir los datos a mano.',
  no_autorizado: 'Tu sesión expiró. Cierra sesión y vuelve a entrar.',
  ia_no_disponible: 'No pude leer la caja ahora. Puedes reintentar o escribir los datos a mano.',
};

export function mensajeErrorAnalisis(error: unknown): string {
  return MENSAJES[codigoDesdeError(error)];
}
