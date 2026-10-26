import { clasificarResultado } from '../clasificar';
import type { Medicamento } from '../tipos';

function med(parcial: Partial<Medicamento> & Pick<Medicamento, 'id' | 'nombre_comercial'>): Medicamento {
  return {
    principios_activos: [],
    dosis: null,
    forma: null,
    laboratorio: null,
    cantidad_envases: 1,
    caja_en_uso: false,
    foto_path: null,
    creado_en: '2026-10-18T10:00:00Z',
    actualizado_en: '2026-10-18T10:00:00Z',
    actualizado_por_email: null,
    ...parcial,
  };
}

const kitadol500 = med({ id: 'k5', nombre_comercial: 'Kitadol', principios_activos: ['paracetamol'], dosis: '500 mg', cantidad_envases: 2 });
const paracetamol1g = med({ id: 'p1', nombre_comercial: 'Paracetamol Lab. Chile', principios_activos: ['paracetamol'], dosis: '1 g' });
const tapsin = med({ id: 't', nombre_comercial: 'Tapsin Día', principios_activos: ['paracetamol', 'fenilefrina'] });
const loratadinaAgotada = med({ id: 'l', nombre_comercial: 'Loratadina', principios_activos: ['loratadina'], dosis: '10 mg', cantidad_envases: 0 });
const inventario = [kitadol500, paracetamol1g, tapsin, loratadinaAgotada];

describe('clasificarResultado', () => {
  it('"tiene" con el mismo nombre y dosis, aunque cambien mayúsculas y unidades', () => {
    const r = clasificarResultado({ nombre_comercial: 'KITADOL', principios_activos: ['paracetamol'], dosis: '0,5 g' }, inventario);
    expect(r).toEqual({ tipo: 'tiene', medicamento: kitadol500 });
  });

  it('"equivalente" con el mismo principio activo, primero los de la misma dosis', () => {
    const r = clasificarResultado({ nombre_comercial: 'Panadol', principios_activos: ['Paracetamol'], dosis: '1000 mg' }, inventario);
    expect(r).toEqual({
      tipo: 'equivalente',
      coincidencias: [
        { medicamento: paracetamol1g, dosisDistinta: false },
        { medicamento: kitadol500, dosisDistinta: true },
      ],
    });
  });

  it('no mezcla combinaciones con productos simples', () => {
    const r = clasificarResultado({ nombre_comercial: 'Tapsin Noche', principios_activos: ['fenilefrina', 'paracetamol'], dosis: null }, inventario);
    expect(r).toEqual({ tipo: 'equivalente', coincidencias: [{ medicamento: tapsin, dosisDistinta: false }] });
  });

  it('el mismo producto sin stock NO cuenta como "tiene" y se informa como agotado', () => {
    const r = clasificarResultado({ nombre_comercial: 'Loratadina', principios_activos: ['loratadina'], dosis: '10 mg' }, inventario);
    expect(r).toEqual({ tipo: 'no_tiene', agotado: loratadinaAgotada });
  });

  it('"no_tiene" cuando no hay nada parecido', () => {
    const r = clasificarResultado({ nombre_comercial: 'Ibupirac', principios_activos: ['ibuprofeno'], dosis: '400 mg' }, inventario);
    expect(r).toEqual({ tipo: 'no_tiene', agotado: null });
  });

  it('sin principio activo solo puede coincidir por nombre', () => {
    const r = clasificarResultado({ nombre_comercial: 'Desconocido', principios_activos: [], dosis: null }, inventario);
    expect(r).toEqual({ tipo: 'no_tiene', agotado: null });
  });

  it('un nombre vacío no coincide con nada por nombre', () => {
    const sinNombre = med({ id: 'x', nombre_comercial: '', cantidad_envases: 3 });
    const r = clasificarResultado({ nombre_comercial: '', principios_activos: [], dosis: null }, [sinNombre]);
    expect(r.tipo).toBe('no_tiene');
  });
});
