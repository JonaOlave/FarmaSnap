import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  /** URL de la foto a mostrar; null cierra la vista. */
  uri: string | null;
  onCerrar: () => void;
}

export function FotoCompleta({ uri, onCerrar }: Props) {
  const margen = useSafeAreaInsets();
  return (
    <Modal visible={uri !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onCerrar}>
      <View style={estilos.fondo}>
        {uri && <Image source={{ uri }} style={estilos.foto} resizeMode="contain" />}
        <Pressable accessibilityLabel="Cerrar foto" onPress={onCerrar} hitSlop={12}
          style={[estilos.cerrar, { top: margen.top + 12 }]}>
          <Text style={estilos.cerrarTexto}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  foto: { width: '100%', height: '100%' },
  cerrar: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  cerrarTexto: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
