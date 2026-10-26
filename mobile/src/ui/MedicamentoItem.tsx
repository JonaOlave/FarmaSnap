import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { textoCantidad } from '../dominio/formato';
import type { Medicamento } from '../dominio/tipos';
import { colores } from './tema';

interface Props {
  medicamento: Medicamento;
  fotoUrl?: string;
  deshabilitado: boolean;
  onAjustar: (delta: number) => void;
  onPress: () => void;
}

export function MedicamentoItem({ medicamento: m, fotoUrl, deshabilitado, onAjustar, onPress }: Props) {
  const sinStock = m.cantidad_envases === 0;
  const detalle = [m.principios_activos.join(' · '), m.forma].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={[estilos.fila, sinStock && estilos.apagado]}>
      {fotoUrl ? (
        <Image source={{ uri: fotoUrl }} style={estilos.miniatura} />
      ) : (
        <View style={[estilos.miniatura, estilos.sinFoto]}>
          <Text style={estilos.inicial}>{m.nombre_comercial.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={estilos.info}>
        <Text style={estilos.nombre} numberOfLines={1}>{[m.nombre_comercial, m.dosis].filter(Boolean).join(' ')}</Text>
        <Text style={estilos.detalle} numberOfLines={1}>{detalle || 'Sin principio activo'}</Text>
        <Text style={[estilos.cantidad, sinStock && { color: colores.no }]}>{textoCantidad(m.cantidad_envases, m.caja_en_uso)}</Text>
      </View>
      <Pressable accessibilityLabel={`Restar un envase de ${m.nombre_comercial}`} disabled={deshabilitado || sinStock}
        onPress={() => onAjustar(-1)} style={[estilos.paso, (deshabilitado || sinStock) && estilos.inactivo]}>
        <Text style={estilos.pasoTexto}>−</Text>
      </Pressable>
      <Pressable accessibilityLabel={`Sumar un envase de ${m.nombre_comercial}`} disabled={deshabilitado}
        onPress={() => onAjustar(1)} style={[estilos.paso, deshabilitado && estilos.inactivo]}>
        <Text style={estilos.pasoTexto}>+</Text>
      </Pressable>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colores.blanco, borderWidth: 1,
    borderColor: colores.linea, borderRadius: 16, padding: 10, marginBottom: 8 },
  apagado: { opacity: 0.55 },
  miniatura: { width: 48, height: 48, borderRadius: 10 },
  sinFoto: { backgroundColor: colores.marcaClaro, alignItems: 'center', justifyContent: 'center' },
  inicial: { fontSize: 20, fontWeight: '700', color: colores.marcaOscuro },
  info: { flex: 1, minWidth: 0 },
  nombre: { fontSize: 15, fontWeight: '600', color: colores.tinta },
  detalle: { fontSize: 12, color: colores.suave, marginTop: 1 },
  cantidad: { fontSize: 12, fontWeight: '600', color: colores.marcaOscuro, marginTop: 3 },
  paso: { width: 34, height: 34, borderRadius: 10, backgroundColor: colores.marcaClaro, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { fontSize: 20, fontWeight: '700', color: colores.marcaOscuro },
  inactivo: { opacity: 0.4 },
});
