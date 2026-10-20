import { mismosPrincipios, principioBase } from '../principios';

describe('principioBase', () => {
  it.each([
    ['bromhidrato de fenoterol', 'fenoterol'],
    ['Bromuro de Ipratropio', 'ipratropio'],
    ['clorhidrato de metformina', 'metformina'],
    ['metformina clorhidrato', 'metformina'],
    ['diclofenaco sódico', 'diclofenaco'],
    ['losartán potásico', 'losartan'],
    ['atorvastatina cálcica', 'atorvastatina'],
    ['amoxicilina trihidrato', 'amoxicilina'],
    ['maleato de enalapril', 'enalapril'],
    ['paracetamol', 'paracetamol'],
    ['sulfato ferroso', 'sulfato ferroso'],
  ])('%s → %s', (entrada, esperado) => {
    expect(principioBase(entrada)).toBe(esperado);
  });
});

describe('mismosPrincipios con sales', () => {
  it('reconoce el mismo principio aunque uno venga con su sal', () => {
    expect(mismosPrincipios(['bromhidrato de fenoterol', 'bromuro de ipratropio'], ['ipratropio', 'fenoterol'])).toBe(true);
  });

  it('sigue distinguiendo principios distintos', () => {
    expect(mismosPrincipios(['clorhidrato de metformina'], ['sitagliptina'])).toBe(false);
  });
});
