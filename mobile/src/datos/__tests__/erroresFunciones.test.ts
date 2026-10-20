import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { codigoDesdeError, ErrorAnalisisFoto, mensajeErrorAnalisis } from '../erroresFunciones';

describe('codigoDesdeError', () => {
  it('traduce los estados HTTP de la Edge Function', () => {
    expect(codigoDesdeError(new FunctionsHttpError({ status: 429 }))).toBe('limite_diario');
    expect(codigoDesdeError(new FunctionsHttpError({ status: 401 }))).toBe('no_autorizado');
    expect(codigoDesdeError(new FunctionsHttpError({ status: 502 }))).toBe('ia_no_disponible');
  });

  it('un fallo de red es "sin_conexion"', () => {
    expect(codigoDesdeError(new FunctionsFetchError(new Error('Network request failed')))).toBe('sin_conexion');
  });

  it('respeta los errores propios y trata lo desconocido como IA no disponible', () => {
    expect(codigoDesdeError(new ErrorAnalisisFoto('limite_diario'))).toBe('limite_diario');
    expect(codigoDesdeError(new Error('raro'))).toBe('ia_no_disponible');
    expect(codigoDesdeError(undefined)).toBe('ia_no_disponible');
  });

  it('da un mensaje en español para cada caso', () => {
    expect(mensajeErrorAnalisis(new FunctionsHttpError({ status: 429 }))).toMatch(/límite diario/);
    expect(mensajeErrorAnalisis(new FunctionsFetchError(null))).toMatch(/Sin conexión/);
  });
});
