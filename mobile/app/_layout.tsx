import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { InventarioProvider } from '../src/datos/InventarioContext';
import { useSesion } from '../src/datos/sesion';
import { colores } from '../src/ui/tema';

export default function RootLayout() {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
        <ActivityIndicator color={colores.marca} />
      </View>
    );
  }

  return (
    <InventarioProvider activo={!!sesion}>
      <Stack screenOptions={{ headerTintColor: colores.marcaOscuro, contentStyle: { backgroundColor: colores.fondo } }}>
        <Stack.Protected guard={!!sesion}>
          <Stack.Screen name="index" options={{ title: 'Botiquín de casa' }} />
          <Stack.Screen name="registrar" options={{ title: 'Nuevo medicamento' }} />
          <Stack.Screen name="buscar-foto" options={{ title: '¿Lo tengo en casa?' }} />
          <Stack.Screen name="medicamento/[id]" options={{ title: 'Detalle' }} />
        </Stack.Protected>
        <Stack.Protected guard={!sesion}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </InventarioProvider>
  );
}
