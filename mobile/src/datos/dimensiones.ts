/** Redimensiona para que el lado mayor no supere `maximo`, sin agrandar. */
export function dimensionesDestino(ancho: number, alto: number, maximo = 1000): { width: number } | { height: number } {
  return alto > ancho ? { height: Math.min(alto, maximo) } : { width: Math.min(ancho, maximo) };
}
