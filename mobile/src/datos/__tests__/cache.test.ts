jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Medicamento } from '../../dominio/tipos';
import { guardarCache, haceCuanto, leerCache } from '../cache';

const kitadol: Medicamento = {
  id: '1', nombre_comercial: 'Kitadol', principios_activos: ['paracetamol'], dosis: '500 mg', forma: null,
  laboratorio: null, cantidad_envases: 2, caja_en_uso: false, foto_path: null, creado_en: '', actualizado_en: '', actualizado_por_email: null,
};

beforeEach(() => AsyncStorage.clear());

describe('caché del inventario', () => {
  it('guarda y lee la lista con su fecha', async () => {
    await guardarCache([kitadol], new Date('2026-10-18T10:00:00Z'));
    expect(await leerCache()).toEqual({ guardadoEn: '2026-10-18T10:00:00.000Z', medicamentos: [kitadol] });
  });

  it('sin caché devuelve null', async () => {
    expect(await leerCache()).toBeNull();
  });

  it('una caché corrupta devuelve null sin lanzar', async () => {
    await AsyncStorage.setItem('farmasnap:inventario:v1', '{no es json');
    expect(await leerCache()).toBeNull();
    await AsyncStorage.setItem('farmasnap:inventario:v1', JSON.stringify({ medicamentos: 'x' }));
    expect(await leerCache()).toBeNull();
  });
});

describe('haceCuanto', () => {
  const ahora = new Date('2026-10-18T12:00:00Z');
  it('describe el tiempo transcurrido', () => {
    expect(haceCuanto('2026-10-18T11:59:40Z', ahora)).toBe('hace un momento');
    expect(haceCuanto('2026-10-18T11:45:00Z', ahora)).toBe('hace 15 min');
    expect(haceCuanto('2026-10-18T09:00:00Z', ahora)).toBe('hace 3 h');
    expect(haceCuanto('2026-10-16T12:00:00Z', ahora)).toBe('hace 2 días');
  });
});
