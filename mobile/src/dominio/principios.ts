import { normalizar } from './normalizar';

// Sales y formas hidratadas que no cambian el principio activo ("bromhidrato de fenoterol" = "fenoterol").
const SALES_ANTES = /^(clorhidrato|hidrocloruro|bromhidrato|bromuro|maleato|fumarato|succinato|tartrato|citrato|besilato|mesilato|fosfato|sulfato) de /;
const SALES_DESPUES = / (clorhidrato|hidrocloruro|bromhidrato|sodico|sodica|potasico|potasica|calcico|calcica|magnesico|magnesica|monohidrato|dihidrato|trihidrato)$/;

/** Principio activo normalizado y sin su sal. */
export function principioBase(texto: string): string {
  let p = normalizar(texto);
  for (let previo = ''; previo !== p; ) {
    previo = p;
    p = p.replace(SALES_ANTES, '').replace(SALES_DESPUES, '');
  }
  return p;
}

function conjunto(lista: string[]): Set<string> {
  return new Set(lista.map(principioBase).filter((p) => p !== ''));
}

/** Mismo conjunto de principios activos (sin importar orden, mayúsculas, tildes ni la sal). */
export function mismosPrincipios(a: string[], b: string[]): boolean {
  const sa = conjunto(a);
  const sb = conjunto(b);
  if (sa.size === 0 || sb.size === 0 || sa.size !== sb.size) return false;
  for (const p of sa) if (!sb.has(p)) return false;
  return true;
}
