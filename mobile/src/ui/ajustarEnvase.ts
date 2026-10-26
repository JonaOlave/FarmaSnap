import { Alert } from 'react-native';
import { preguntarCajaEnUso } from '../dominio/formato';
import type { Medicamento } from '../dominio/tipos';
import { confirmar } from './confirmar';

interface Acciones {
  ajustar: (id: string, delta: number) => Promise<void>;
  marcarEnUso: (id: string, enUso: boolean) => Promise<void>;
}

function preguntar(titulo: string, mensaje: string): Promise<boolean> {
  return new Promise((resolver) => {
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: 'No', style: 'cancel', onPress: () => resolver(false) },
        { text: 'Sí, en uso', onPress: () => resolver(true) },
      ],
      { cancelable: true, onDismiss: () => resolver(false) },
    );
  });
}

/** Suma o resta un envase con los avisos de "se acabó" y de abrir la última caja. */
export async function ajustarEnvase(m: Medicamento, delta: number, { ajustar, marcarEnUso }: Acciones): Promise<void> {
  if (delta < 0 && m.cantidad_envases === 1 &&
      !(await confirmar('¿Se acabó?', `${m.nombre_comercial} quedará como "Sin stock".`, 'Sí, se acabó'))) {
    return;
  }
  try {
    await ajustar(m.id, delta);
    if (preguntarCajaEnUso(m.cantidad_envases, delta) &&
        (await preguntar('Queda 1 envase', `¿Marcar la caja de ${m.nombre_comercial} que queda como en uso?`))) {
      await marcarEnUso(m.id, true);
    }
  } catch {
    Alert.alert('No se pudo actualizar', 'Revisa tu conexión e inténtalo de nuevo.');
  }
}
