import { parsearPrincipios, textoCantidad, textoOpcional, valoresDesdeExtraccion } from '../formato';

describe('formato', () => {
  it('textoCantidad', () => {
    expect(textoCantidad(0)).toBe('Sin stock');
    expect(textoCantidad(1)).toBe('1 envase');
    expect(textoCantidad(3)).toBe('3 envases');
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
