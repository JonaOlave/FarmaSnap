import { normalizar } from './normalizar';

function conjunto(lista: string[]): Set<string> {
  return new Set(lista.map(normalizar).filter((p) => p !== ''));
}

/** Mismo conjunto de principios activos (sin importar orden, mayúsculas ni tildes). */
export function mismosPrincipios(a: string[], b: string[]): boolean {
  const sa = conjunto(a);
  const sb = conjunto(b);
  if (sa.size === 0 || sb.size === 0 || sa.size !== sb.size) return false;
  for (const p of sa) if (!sb.has(p)) return false;
  return true;
}
