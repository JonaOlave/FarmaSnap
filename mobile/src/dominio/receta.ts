import { clasificarResultado } from './clasificar';
import { mismaDosis } from './dosis';
import { normalizar } from './normalizar';
import type { EstadoReceta, FilaReceta, Medicamento, MedicamentoRecetado } from './tipos';

const MAX_SIMILARES = 3;

function estadoDe(recetado: MedicamentoRecetado, inventario: Medicamento[]): EstadoReceta {
  const { nombre, principios_activos, dosis } = recetado;
  const r = clasificarResultado({ nombre_comercial: nombre, principios_activos, dosis }, inventario);
  if (r.tipo === 'tiene') return { tipo: 'en_casa', medicamento: r.medicamento };
  if (r.tipo === 'equivalente') return { tipo: 'similar', coincidencias: r.coincidencias.slice(0, MAX_SIMILARES) };

  // Mismo nombre con otra dosis cuenta como similar aunque la receta no traiga principios activos.
  const clave = normalizar(nombre);
  const otraDosis = inventario.find((m) => m.cantidad_envases > 0 && normalizar(m.nombre_comercial) === clave);
  if (otraDosis) {
    return { tipo: 'similar', coincidencias: [{ medicamento: otraDosis, dosisDistinta: !mismaDosis(otraDosis.dosis, dosis) }] };
  }
  return r.agotado ? { tipo: 'sin_stock', medicamento: r.agotado } : { tipo: 'no_registrado' };
}

/** Estado de cada medicamento recetado frente al inventario, en el orden de la receta. Solo consulta. */
export function clasificarReceta(recetados: MedicamentoRecetado[], inventario: Medicamento[]): FilaReceta[] {
  return recetados.map((recetado) => ({ recetado, estado: estadoDe(recetado, inventario) }));
}
