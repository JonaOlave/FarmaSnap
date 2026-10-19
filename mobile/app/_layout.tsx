import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
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
    <Stack screenOptions={{ headerTintColor: colores.marcaOscuro, contentStyle: { backgroundColor: colores.fondo } }}>
      <Stack.Protected guard={!!sesion}>
        <Stack.Screen name="index" options={{ title: 'Botiquín de casa' }} />
      </Stack.Protected>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
