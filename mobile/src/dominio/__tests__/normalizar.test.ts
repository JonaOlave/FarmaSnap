import { normalizar } from '../normalizar';

describe('normalizar', () => {
  it('pasa a minúsculas y quita tildes', () => {
    expect(normalizar('Ibuprofeno')).toBe('ibuprofeno');
    expect(normalizar('Cafeína')).toBe('cafeina');
    expect(normalizar('Tapsin DÍA')).toBe('tapsin dia');
  });

  it('colapsa y recorta espacios', () => {
    expect(normalizar('  500   MG ')).toBe('500 mg');
  });

  it('trata null y undefined como texto vacío', () => {
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });

  it('convierte ñ en n, igual que unaccent en la base de datos', () => {
    expect(normalizar('Niño')).toBe('nino');
  });
});
