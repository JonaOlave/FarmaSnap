import { normalizar } from './normalizar';
import type { DatosMedicamento, Medicamento } from './tipos';

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

function palabraCoincide(token: string, palabra: string): boolean {
  if (palabra.includes(token)) return true;
  if (token.length < 5) return false;
  // Compara con el inicio de la palabra del mismo largo (admite escribir solo el comienzo).
  return distancia(token, palabra.slice(0, token.length)) <= 1 || distancia(token, palabra) <= 1;
}

export function ordenarInventario(lista: Medicamento[]): Medicamento[] {
  return [...lista].sort(
    (a, b) =>
      Number(b.cantidad_envases > 0) - Number(a.cantidad_envases > 0) ||
      normalizar(a.nombre_comercial).localeCompare(normalizar(b.nombre_comercial)),
  );
}

export function buscarPorTexto(consulta: string, inventario: Medicamento[]): Medicamento[] {
  const tokens = normalizar(consulta).split(' ').filter(Boolean);
  if (tokens.length === 0) return ordenarInventario(inventario);
  const resultado = inventario.filter((m) => {
    const palabras = normalizar([m.nombre_comercial, ...m.principios_activos].join(' ')).split(' ');
    return tokens.every((t) => palabras.some((p) => palabraCoincide(t, p)));
  });
  return ordenarInventario(resultado);
}

/** Misma regla que el índice único de la base de datos. */
export function buscarDuplicado(
  datos: Pick<DatosMedicamento, 'nombre_comercial' | 'dosis'>,
  inventario: Medicamento[],
  excluirId?: string,
): Medicamento | undefined {
  const nombre = normalizar(datos.nombre_comercial);
  const dosis = normalizar(datos.dosis);
  return inventario.find(
    (m) => m.id !== excluirId && normalizar(m.nombre_comercial) === nombre && normalizar(m.dosis) === dosis,
  );
}
