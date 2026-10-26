import { clasificarReceta } from '../receta';
import type { Medicamento, MedicamentoRecetado } from '../tipos';

function med(parcial: Partial<Medicamento> & Pick<Medicamento, 'id' | 'nombre_comercial'>): Medicamento {
  return {
    principios_activos: [],
    dosis: null,
    forma: null,
    laboratorio: null,
    cantidad_envases: 1,
    caja_en_uso: false,
    foto_path: null,
    creado_en: '2026-10-20T10:00:00Z',
    actualizado_en: '2026-10-20T10:00:00Z',
    actualizado_por_email: null,
    ...parcial,
  };
}

function rec(nombre: string, principios_activos: string[] = [], dosis: string | null = null): MedicamentoRecetado {
  return { nombre, principios_activos, principios_deducidos: false, dosis, forma: null };
}

const kitadol = med({ id: 'k', nombre_comercial: 'Kitadol', principios_activos: ['paracetamol'], dosis: '500 mg', cantidad_envases: 2 });
const ibuprofeno = med({ id: 'i', nombre_comercial: 'Ibuprofeno', principios_activos: ['ibuprofeno'], dosis: '400 mg' });
const loratadina = med({ id: 'l', nombre_comercial: 'Loratadina', principios_activos: ['loratadina'], dosis: '10 mg', cantidad_envases: 0 });
const berodual = med({ id: 'b', nombre_comercial: 'Berodual', principios_activos: ['fenoterol', 'ipratropio'] });
const inventario = [kitadol, ibuprofeno, loratadina, berodual];

describe('clasificarReceta', () => {
  it('en casa: mismo producto con stock', () => {
    expect(clasificarReceta([rec('Berodual')], inventario)[0].estado).toEqual({ tipo: 'en_casa', medicamento: berodual });
  });

  it('similar por principio activo', () => {
    expect(clasificarReceta([rec('Ibuprofeno forte', ['ibuprofeno'], '200 mg/5 ml')], inventario)[0].estado).toEqual({
      tipo: 'similar', coincidencias: [{ medicamento: ibuprofeno, dosisDistinta: true }],
    });
  });

  it('similar por mismo nombre y otra dosis aunque no tenga principios', () => {
    expect(clasificarReceta([rec('Kitadol', [], '1 g')], inventario)[0].estado).toEqual({
      tipo: 'similar', coincidencias: [{ medicamento: kitadol, dosisDistinta: true }],
    });
  });

  it('sin stock: registrado con 0 envases', () => {
    expect(clasificarReceta([rec('Loratadina', ['loratadina'], '10 mg')], inventario)[0].estado).toEqual({
      tipo: 'sin_stock', medicamento: loratadina,
    });
  });

  it('no registrado cuando solo trae la marca', () => {
    expect(clasificarReceta([rec('Fesema')], inventario)[0].estado).toEqual({ tipo: 'no_registrado' });
  });

  it('no registrado con principios que no están en casa', () => {
    expect(clasificarReceta([rec('Coritex forte', ['clorfenamina'])], inventario)[0].estado).toEqual({ tipo: 'no_registrado' });
  });

  it('similar se limita a 3 coincidencias', () => {
    const paracetamoles = [1, 2, 3, 4, 5].map((n) =>
      med({ id: `p${n}`, nombre_comercial: `Paracetamol ${n}`, principios_activos: ['paracetamol'] }));
    const estado = clasificarReceta([rec('Panadol', ['paracetamol'])], paracetamoles)[0].estado;
    expect(estado.tipo === 'similar' && estado.coincidencias).toHaveLength(3);
  });

  it('mantiene el orden de la receta', () => {
    const filas = clasificarReceta([rec('Fesema'), rec('Berodual'), rec('Loratadina')], inventario);
    expect(filas.map((f) => f.recetado.nombre)).toEqual(['Fesema', 'Berodual', 'Loratadina']);
  });
});
