import type { Extraccion } from '../dominio/tipos';
import { ErrorAnalisisFoto } from './erroresFunciones';
import { supabase } from './supabase';

export async function analizarFoto(imagenBase64: string, limiteMs = 45_000): Promise<Extraccion> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new ErrorAnalisisFoto('ia_no_disponible')), limiteMs);
  });
  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<Extraccion>('analizar-foto', { body: { imagen_base64: imagenBase64 } }),
      limite,
    ]);
    if (error) throw error;
    if (!data) throw new ErrorAnalisisFoto('ia_no_disponible');
    return data;
  } finally {
    clearTimeout(temporizador);
  }
}
