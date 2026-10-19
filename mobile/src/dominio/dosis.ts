import { normalizar } from './normalizar';

const UNIDADES: Record<string, { base: string; factor: number }> = {
  mcg: { base: 'mg', factor: 0.001 },
  ug: { base: 'mg', factor: 0.001 },
  'µg': { base: 'mg', factor: 0.001 },
  mg: { base: 'mg', factor: 1 },
  g: { base: 'mg', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  ui: { base: 'ui', factor: 1 },
  '%': { base: '%', factor: 1 },
};

export interface DosisParseada {
  valor: number;
  unidad: string;
}

export function parsearDosis(texto: string | null): DosisParseada | null {
  const t = normalizar(texto).replace(',', '.');
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(mcg|ug|µg|mg|g|ml|l|ui|%)$/);
  if (!m) return null;
  const unidad = UNIDADES[m[2]];
  return { valor: Math.round(parseFloat(m[1]) * unidad.factor * 1000) / 1000, unidad: unidad.base };
}

/** Misma dosis tras convertir unidades. Si a una le falta la dosis, se consideran compatibles. */
export function mismaDosis(a: string | null, b: string | null): boolean {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (na === '' || nb === '') return true;
  const pa = parsearDosis(a);
  const pb = parsearDosis(b);
  if (pa && pb) return pa.valor === pb.valor && pa.unidad === pb.unidad;
  return na === nb;
}
