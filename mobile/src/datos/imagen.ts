import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { dimensionesDestino, LADO_CAJA } from './dimensiones';

export interface FotoPreparada {
  uri: string;
  base64: string;
}

export async function prepararFoto(uri: string, ancho: number, alto: number, maximo = LADO_CAJA): Promise<FotoPreparada> {
  const resultado = await manipulateAsync(uri, [{ resize: dimensionesDestino(ancho, alto, maximo) }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!resultado.base64) throw new Error('No se pudo procesar la foto');
  return { uri: resultado.uri, base64: resultado.base64 };
}
