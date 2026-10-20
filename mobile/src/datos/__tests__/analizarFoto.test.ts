import { analizarFoto, analizarReceta } from '../analizarFoto';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

const invoke = supabase.functions.invoke as jest.Mock;

beforeEach(() => invoke.mockReset());

describe('analizarReceta', () => {
  it('envía tipo receta y devuelve los datos', async () => {
    const receta = { es_receta: true, medicamentos: [] };
    invoke.mockResolvedValue({ data: receta, error: null });
    await expect(analizarReceta('QUJD')).resolves.toEqual(receta);
    expect(invoke).toHaveBeenCalledWith('analizar-foto', { body: { imagen_base64: 'QUJD', tipo: 'receta' } });
  });

  it('propaga el error de la función', async () => {
    const error = new Error('caída');
    invoke.mockResolvedValue({ data: null, error });
    await expect(analizarReceta('QUJD')).rejects.toBe(error);
  });
});

describe('analizarFoto', () => {
  it('no envía tipo (la función lo trata como caja)', async () => {
    invoke.mockResolvedValue({ data: { legible: true }, error: null });
    await analizarFoto('QUJD');
    expect(invoke).toHaveBeenCalledWith('analizar-foto', { body: { imagen_base64: 'QUJD' } });
  });
});
