import type { Extraccion, ValoresFormulario } from './tipos';

export function textoCantidad(n: number): string {
  if (n === 0) return 'Sin stock';
  return n === 1 ? '1 envase' : `${n} envases`;
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
