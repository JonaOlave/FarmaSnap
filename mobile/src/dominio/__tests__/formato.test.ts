import { parsearPrincipios, preguntarCajaEnUso, textoCantidad, textoOpcional, valoresDesdeExtraccion } from '../formato';

describe('formato', () => {
  it('textoCantidad', () => {
    expect(textoCantidad(0)).toBe('Sin stock');
    expect(textoCantidad(1)).toBe('1 envase');
    expect(textoCantidad(3)).toBe('3 envases');
  });

  it('textoCantidad detalla la caja en uso', () => {
    expect(textoCantidad(3, true)).toBe('3 envases · 1 en uso, 2 nuevos');
    expect(textoCantidad(2, true)).toBe('2 envases · 1 en uso, 1 nuevo');
    expect(textoCantidad(1, true)).toBe('1 envase · en uso');
    expect(textoCantidad(0, true)).toBe('Sin stock');
  });

  it('preguntarCajaEnUso solo al restar de 2 a 1', () => {
    expect(preguntarCajaEnUso(2, -1)).toBe(true);
    expect(preguntarCajaEnUso(3, -1)).toBe(false);
    expect(preguntarCajaEnUso(1, -1)).toBe(false);
    expect(preguntarCajaEnUso(0, 1)).toBe(false);
  });

  it('parsearPrincipios separa por coma, punto y coma o +, y limpia', () => {
    expect(parsearPrincipios('Paracetamol, Cafeína + paracetamol;  ')).toEqual(['paracetamol', 'cafeína']);
    expect(parsearPrincipios('   ')).toEqual([]);
  });

  it('textoOpcional', () => {
    expect(textoOpcional('  500  mg ')).toBe('500 mg');
    expect(textoOpcional('   ')).toBeNull();
  });

  it('valoresDesdeExtraccion arma el formulario con 1 envase', () => {
    expect(valoresDesdeExtraccion({
      legible: true, es_medicamento: true, nombre_comercial: null,
      principios_activos: ['ibuprofeno'], dosis: '400 mg', forma: null, laboratorio: null,
    })).toEqual({
      nombre_comercial: '', principios_activos: ['ibuprofeno'], dosis: '400 mg',
      forma: null, laboratorio: null, cantidad_envases: 1,
    });
  });
});
