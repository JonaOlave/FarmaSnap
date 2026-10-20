import type { Extraccion } from '../dominio/tipos';
import type { FotoPreparada } from './imagen';

/** Pasa la foto y los datos de "Buscar por foto" a "Registrar" sin volver a sacar la foto. */
export interface CapturaPendiente {
  datos: Extraccion;
  foto: FotoPreparada | null;
}

let pendiente: CapturaPendiente | null = null;

export function guardarCapturaPendiente(captura: CapturaPendiente): void {
  pendiente = captura;
}

export function leerCapturaPendiente(): CapturaPendiente | null {
  return pendiente;
}

export function limpiarCapturaPendiente(): void {
  pendiente = null;
}
