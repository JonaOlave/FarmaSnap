import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Medicamento } from '../dominio/tipos';

const CLAVE = 'farmasnap:inventario:v1';

export interface CacheInventario {
  guardadoEn: string;
  medicamentos: Medicamento[];
}

export async function guardarCache(medicamentos: Medicamento[], ahora = new Date()): Promise<void> {
  try {
    const valor: CacheInventario = { guardadoEn: ahora.toISOString(), medicamentos };
    await AsyncStorage.setItem(CLAVE, JSON.stringify(valor));
  } catch {
    // La caché es una comodidad: si falla, la app sigue funcionando en línea.
  }
}

export async function leerCache(): Promise<CacheInventario | null> {
  try {
    const texto = await AsyncStorage.getItem(CLAVE);
    if (!texto) return null;
    const valor = JSON.parse(texto) as Partial<CacheInventario>;
    if (typeof valor.guardadoEn !== 'string' || !Array.isArray(valor.medicamentos)) return null;
    return { guardadoEn: valor.guardadoEn, medicamentos: valor.medicamentos };
  } catch {
    return null;
  }
}

export function haceCuanto(desdeIso: string, ahora = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - new Date(desdeIso).getTime()) / 60_000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}
