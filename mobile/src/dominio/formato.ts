import type { Extraccion, ValoresFormulario } from './tipos';

export function textoCantidad(n: number, cajaEnUso = false): string {
  if (n === 0) return 'Sin stock';
  const total = n === 1 ? '1 envase' : `${n} envases`;
  return cajaEnUso ? `${total} · ${detalleEnUso(n)}` : total;
}

export function detalleEnUso(n: number): string {
  if (n === 1) return 'en uso';
  const nuevos = n - 1;
  return `1 en uso, ${nuevos} ${nuevos === 1 ? 'nuevo' : 'nuevos'}`;
}

/** Al restar y quedar 1 envase (sin caja abierta, porque restar la cierra), se pregunta si se abre. */
export function preguntarCajaEnUso(cantidadAntes: number, delta: number): boolean {
  return delta < 0 && cantidadAntes + delta === 1;
}

export function textoOpcional(texto: string): string | null {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

export function parsearPrincipios(texto: string): string[] {
  return [
    ...new Set(
      texto
        .split(/[,;+]/)
        .map((p) => p.replace(/\s+/g, ' ').trim().toLowerCase())
        .filter((p) => p !== ''),
    ),
  ];
}

export function valoresDesdeExtraccion(e: Extraccion): ValoresFormulario {
  return {
    nombre_comercial: e.nombre_comercial ?? '',
    principios_activos: e.principios_activos,
    dosis: e.dosis,
    forma: e.forma,
    laboratorio: e.laboratorio,
    cantidad_envases: 1,
  };
}
