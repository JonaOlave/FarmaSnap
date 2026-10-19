import { mismaDosis, parsearDosis } from '../dosis';
import { mismosPrincipios } from '../principios';

describe('parsearDosis', () => {
  it('convierte a una unidad base', () => {
    expect(parsearDosis('1 g')).toEqual({ valor: 1000, unidad: 'mg' });
    expect(parsearDosis('500mg')).toEqual({ valor: 500, unidad: 'mg' });
    expect(parsearDosis('250 mcg')).toEqual({ valor: 0.25, unidad: 'mg' });
    expect(parsearDosis('1,5 G')).toEqual({ valor: 1500, unidad: 'mg' });
    expect(parsearDosis('0.5 l')).toEqual({ valor: 500, unidad: 'ml' });
  });

  it('devuelve null si no puede interpretar', () => {
    expect(parsearDosis('100 mg/5 ml')).toBeNull();
    expect(parsearDosis('')).toBeNull();
    expect(parsearDosis(null)).toBeNull();
  });
});

describe('mismaDosis', () => {
  it('reconoce la misma dosis escrita distinto', () => {
    expect(mismaDosis('1 g', '1000 mg')).toBe(true);
    expect(mismaDosis('1000mg', '1,0 g')).toBe(true);
    expect(mismaDosis('500 MG', '500 mg')).toBe(true);
  });

  it('distingue dosis distintas', () => {
    expect(mismaDosis('500 mg', '1 g')).toBe(false);
    expect(mismaDosis('5 ml', '5 mg')).toBe(false);
  });

  it('compara como texto lo que no puede interpretar', () => {
    expect(mismaDosis('100 mg/5 ml', '100 MG/5 ML')).toBe(true);
    expect(mismaDosis('100 mg/5 ml', '200 mg/5 ml')).toBe(false);
  });

  it('considera compatibles si a una le falta la dosis', () => {
    expect(mismaDosis(null, '500 mg')).toBe(true);
    expect(mismaDosis('500 mg', '  ')).toBe(true);
    expect(mismaDosis(null, null)).toBe(true);
  });
});

describe('mismosPrincipios', () => {
  it('ignora orden, mayúsculas y tildes', () => {
    expect(mismosPrincipios(['Cafeína', 'PARACETAMOL'], ['paracetamol', 'cafeina'])).toBe(true);
  });

  it('exige el mismo conjunto', () => {
    expect(mismosPrincipios(['paracetamol'], ['paracetamol', 'cafeína'])).toBe(false);
  });

  it('nunca considera equivalente una lista vacía', () => {
    expect(mismosPrincipios([], [])).toBe(false);
    expect(mismosPrincipios(['paracetamol'], [])).toBe(false);
  });
});
