import { Text, View } from 'react-native';
import { supabase } from '../src/datos/supabase';
import { Boton } from '../src/ui/Boton';

export default function Inventario() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ textAlign: 'center', marginBottom: 12 }}>Sesión iniciada ✔</Text>
      <Boton titulo="Cerrar sesión" variante="secundario" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}
