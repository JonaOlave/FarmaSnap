import { buscarDuplicado, buscarPorTexto, ordenarInventario } from '../buscar';
import type { Medicamento } from '../tipos';

function med(id: string, nombre: string, principios: string[], cantidad = 1, dosis: string | null = null): Medicamento {
  return {
    id, nombre_comercial: nombre, principios_activos: principios, dosis, forma: null, laboratorio: null,
    cantidad_envases: cantidad, caja_en_uso: false, foto_path: null, creado_en: '', actualizado_en: '', actualizado_por_email: null,
  };
}

const kitadol = med('1', 'Kitadol', ['paracetamol'], 2, '500 mg');
const ibupirac = med('2', 'Ibupirac', ['ibuprofeno'], 1, '400 mg');
const loratadina = med('3', 'Loratadina', ['loratadina'], 0, '10 mg');
const tapsin = med('4', 'Tapsin Día', ['paracetamol', 'fenilefrina'], 1);
const inventario = [loratadina, tapsin, ibupirac, kitadol];

describe('buscarPorTexto', () => {
  it('sin consulta devuelve todo, con stock primero y por nombre', () => {
    expect(buscarPorTexto('', inventario).map((m) => m.id)).toEqual(['2', '1', '4', '3']);
  });

  it('busca por nombre comercial y por principio activo', () => {
    expect(buscarPorTexto('kitadol', inventario).map((m) => m.id)).toEqual(['1']);
    expect(buscarPorTexto('paracetamol', inventario).map((m) => m.id)).toEqual(['1', '4']);
  });

  it('ignora tildes y mayúsculas y acepta prefijos', () => {
    expect(buscarPorTexto('TAPSIN dia', inventario).map((m) => m.id)).toEqual(['4']);
    expect(buscarPorTexto('ibu', inventario).map((m) => m.id)).toEqual(['2']);
  });

  it('tolera un error de tipeo en palabras de 5 letras o más', () => {
    expect(buscarPorTexto('ibuprofemo', inventario).map((m) => m.id)).toEqual(['2']);
    expect(buscarPorTexto('kitadl', inventario).map((m) => m.id)).toEqual(['1']);
  });

  it('no tolera errores en palabras cortas', () => {
    expect(buscarPorTexto('kxt', inventario)).toEqual([]);
  });

  it('exige que coincidan todas las palabras', () => {
    expect(buscarPorTexto('paracetamol fenilefrina', inventario).map((m) => m.id)).toEqual(['4']);
  });

  it('incluye los "Sin stock" al final', () => {
    expect(buscarPorTexto('lorat', inventario).map((m) => m.id)).toEqual(['3']);
  });
});

describe('ordenarInventario', () => {
  it('no modifica la lista original', () => {
    const copia = [...inventario];
    ordenarInventario(inventario);
    expect(inventario).toEqual(copia);
  });
});

describe('buscarDuplicado', () => {
  it('encuentra el mismo nombre y dosis aunque cambien mayúsculas, tildes y espacios', () => {
    expect(buscarDuplicado({ nombre_comercial: ' KITÁDOL ', dosis: '500  MG' }, inventario)).toBe(kitadol);
  });

  it('otra dosis no es duplicado', () => {
    expect(buscarDuplicado({ nombre_comercial: 'Kitadol', dosis: '1 g' }, inventario)).toBeUndefined();
  });

  it('dosis vacía solo coincide con dosis vacía', () => {
    expect(buscarDuplicado({ nombre_comercial: 'Tapsin día', dosis: null }, inventario)).toBe(tapsin);
    expect(buscarDuplicado({ nombre_comercial: 'Kitadol', dosis: null }, inventario)).toBeUndefined();
  });

  it('puede excluir el propio medicamento al editar', () => {
    expect(buscarDuplicado({ nombre_comercial: 'Kitadol', dosis: '500 mg' }, inventario, '1')).toBeUndefined();
  });
});
