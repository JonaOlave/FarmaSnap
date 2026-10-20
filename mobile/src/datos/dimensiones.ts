/** Lado mayor para fotos de cajas. */
export const LADO_CAJA = 1000;
/** Lado mayor para recetas: la letra es más chica; 1568 px es lo máximo que Claude usa sin reducir. */
export const LADO_RECETA = 1568;

/** Redimensiona para que el lado mayor no supere `maximo`, sin agrandar. */
export function dimensionesDestino(ancho: number, alto: number, maximo = LADO_CAJA): { width: number } | { height: number } {
  return alto > ancho ? { height: Math.min(alto, maximo) } : { width: Math.min(ancho, maximo) };
}
