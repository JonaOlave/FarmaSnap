import { StyleSheet, Text, View } from 'react-native';
import { haceCuanto } from '../datos/cache';
import { colores } from './tema';

export function AvisoConexion({ sinConexion, actualizadoEn }: { sinConexion: boolean; actualizadoEn: string | null }) {
  if (!sinConexion) return null;
  return (
    <View style={estilos.aviso}>
      <Text style={estilos.texto}>
        Sin conexión · {actualizadoEn ? `datos de ${haceCuanto(actualizadoEn)}` : 'sin datos guardados'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: { backgroundColor: colores.eqClaro, borderRadius: 10, padding: 8, marginBottom: 8 },
  texto: { color: '#7a4e08', fontSize: 12, textAlign: 'center' },
});
