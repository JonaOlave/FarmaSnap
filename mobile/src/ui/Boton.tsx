import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colores } from './tema';

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  cargando?: boolean;
}

export function Boton({ titulo, onPress, variante = 'primario', deshabilitado, cargando }: Props) {
  const inactivo = deshabilitado || cargando;
  const colorTexto = variante === 'primario' ? colores.blanco : variante === 'peligro' ? colores.no : colores.marcaOscuro;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [estilos.base, estilos[variante], inactivo && estilos.inactivo, pressed && estilos.presionado]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <Text style={[estilos.texto, { color: colorTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primario: { backgroundColor: colores.marca },
  secundario: { borderWidth: 1.5, borderColor: colores.marca },
  peligro: {},
  inactivo: { opacity: 0.5 },
  presionado: { opacity: 0.8 },
  texto: { fontWeight: '600', fontSize: 15 },
});
