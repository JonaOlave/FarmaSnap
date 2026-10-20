import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { dimensionesDestino } from './dimensiones';

export interface FotoPreparada {
  uri: string;
  base64: string;
}

export async function prepararFoto(uri: string, ancho: number, alto: number): Promise<FotoPreparada> {
  const resultado = await manipulateAsync(uri, [{ resize: dimensionesDestino(ancho, alto) }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!resultado.base64) throw new Error('No se pudo procesar la foto');
  return { uri: resultado.uri, base64: resultado.base64 };
}
