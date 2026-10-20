import type { Extraccion, ExtraccionReceta } from '../dominio/tipos';
import { ErrorAnalisisFoto } from './erroresFunciones';
import { supabase } from './supabase';

async function invocar<T>(body: object, limiteMs: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new ErrorAnalisisFoto('ia_no_disponible')), limiteMs);
  });
  try {
    const { data, error } = await Promise.race([supabase.functions.invoke<T>('analizar-foto', { body }), limite]);
    if (error) throw error;
    if (!data) throw new ErrorAnalisisFoto('ia_no_disponible');
    return data;
  } finally {
    clearTimeout(temporizador);
  }
}

export function analizarFoto(imagenBase64: string, limiteMs = 45_000): Promise<Extraccion> {
  return invocar<Extraccion>({ imagen_base64: imagenBase64 }, limiteMs);
}

export function analizarReceta(imagenBase64: string, limiteMs = 60_000): Promise<ExtraccionReceta> {
  return invocar<ExtraccionReceta>({ imagen_base64: imagenBase64, tipo: 'receta' }, limiteMs);
}
