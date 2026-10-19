import { mismaDosis } from './dosis';
import { normalizar } from './normalizar';
import { mismosPrincipios } from './principios';
import type { DatosMedicamento, Medicamento, ResultadoBusqueda } from './tipos';

export function clasificarResultado(
  buscado: Pick<DatosMedicamento, 'nombre_comercial' | 'principios_activos' | 'dosis'>,
  inventario: Medicamento[],
): ResultadoBusqueda {
  const nombre = normalizar(buscado.nombre_comercial);
  const mismoProducto = nombre === ''
    ? []
    : inventario.filter((m) => normalizar(m.nombre_comercial) === nombre && mismaDosis(m.dosis, buscado.dosis));

  const conStock = mismoProducto.find((m) => m.cantidad_envases > 0);
  if (conStock) return { tipo: 'tiene', medicamento: conStock };

  const coincidencias = inventario
    .filter((m) => m.cantidad_envases > 0 && mismosPrincipios(m.principios_activos, buscado.principios_activos))
    .map((m) => ({ medicamento: m, dosisDistinta: !mismaDosis(m.dosis, buscado.dosis) }))
    .sort((x, y) => Number(x.dosisDistinta) - Number(y.dosisDistinta));
  if (coincidencias.length > 0) return { tipo: 'equivalente', coincidencias };

  return { tipo: 'no_tiene', agotado: mismoProducto[0] ?? null };
}
