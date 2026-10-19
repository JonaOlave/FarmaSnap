import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../src/datos/supabase';
import { Boton } from '../src/ui/Boton';
import { colores } from '../src/ui/tema';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ingresar() {
    setEnviando(true);
    setError(null);
    const { error: fallo } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (fallo) {
      setError(
        fallo.message.toLowerCase().includes('invalid')
          ? 'Correo o contraseña incorrectos.'
          : 'No se pudo iniciar sesión. Revisa tu conexión.',
      );
    }
    // Si funciona, el layout cambia solo a la pantalla de inventario (onAuthStateChange).
  }

  return (
    <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.logo}><Text style={estilos.logoTexto}>+</Text></View>
      <Text style={estilos.titulo}>FarmaSnap</Text>
      <Text style={estilos.lema}>El botiquín de la casa, en tu bolsillo</Text>

      <Text style={estilos.etiqueta}>CORREO</Text>
      <TextInput style={estilos.campo} value={correo} onChangeText={setCorreo} autoCapitalize="none"
        autoComplete="email" keyboardType="email-address" placeholder="nombre@correo.cl" />
      <Text style={estilos.etiqueta}>CONTRASEÑA</Text>
      <TextInput style={estilos.campo} value={clave} onChangeText={setClave} secureTextEntry
        autoComplete="password" placeholder="••••••••" />

      {error && <Text style={estilos.error}>{error}</Text>}
      <Boton titulo="Ingresar" onPress={ingresar} cargando={enviando} deshabilitado={!correo.trim() || !clave} />
      <Text style={estilos.nota}>Solo una vez por teléfono. Las cuentas las crea el administrador.</Text>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: colores.fondo },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: colores.marca, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoTexto: { color: colores.blanco, fontSize: 40, fontWeight: '700' },
  titulo: { fontSize: 26, fontWeight: '700', textAlign: 'center', color: colores.tinta },
  lema: { textAlign: 'center', color: colores.suave, marginBottom: 24 },
  etiqueta: { fontSize: 11, fontWeight: '600', color: colores.suave, marginTop: 10 },
  campo: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 11,
    padding: 12, marginTop: 4, fontSize: 15 },
  error: { color: colores.no, marginTop: 12 },
  nota: { textAlign: 'center', color: colores.suave, fontSize: 12, marginTop: 14 },
});
