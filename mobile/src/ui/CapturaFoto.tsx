import { CameraView, useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type FotoPreparada, prepararFoto } from '../datos/imagen';
import { Boton } from './Boton';
import { colores } from './tema';

interface Props {
  onCaptura: (foto: FotoPreparada) => void;
  onCancelar: () => void;
  indicacion?: string;
}

export function CapturaFoto({ onCaptura, onCancelar, indicacion = 'Encuadra el frente de la caja' }: Props) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [procesando, setProcesando] = useState(false);
  const margen = useSafeAreaInsets();

  if (!permiso) return <View style={estilos.negro} />;

  async function elegirDeGaleria() {
    if (procesando) return;
    setProcesando(true);
    try {
      const resultado = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      const foto = resultado.canceled ? undefined : resultado.assets[0];
      if (foto) onCaptura(await prepararFoto(foto.uri, foto.width, foto.height));
    } catch {
      Alert.alert('No se pudo abrir la foto', 'Inténtalo de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  if (!permiso.granted) {
    return (
      <View style={estilos.permiso}>
        <Text style={estilos.permisoTexto}>FarmaSnap necesita la cámara para leer las cajas de los medicamentos.</Text>
        <Boton titulo="Permitir cámara" onPress={() => { pedirPermiso(); }} />
        <Boton titulo="Elegir de la galería" variante="secundario" onPress={elegirDeGaleria} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} />
      </View>
    );
  }

  async function capturar() {
    if (!camara.current || procesando) return;
    setProcesando(true);
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.9 });
      if (foto) onCaptura(await prepararFoto(foto.uri, foto.width, foto.height));
    } catch {
      Alert.alert('No se pudo tomar la foto', 'Inténtalo de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <View style={estilos.negro}>
      <CameraView ref={camara} style={StyleSheet.absoluteFill} facing="back" />
      <Text style={estilos.indicacion}>{indicacion}</Text>
      <View style={estilos.marco} pointerEvents="none" />
      <View style={[estilos.barra, { height: 120 + margen.bottom, paddingBottom: margen.bottom }]}>
        <Pressable onPress={onCancelar} style={estilos.lado}><Text style={estilos.cancelar}>Cancelar</Text></Pressable>
        <Pressable accessibilityLabel="Tomar foto" onPress={capturar} disabled={procesando} style={estilos.obturador}>
          {procesando ? <ActivityIndicator color={colores.blanco} /> : <View style={estilos.obturadorInterno} />}
        </Pressable>
        <Pressable onPress={elegirDeGaleria} disabled={procesando} style={estilos.lado}>
          <Text style={[estilos.cancelar, estilos.derecha]}>Galería</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  negro: { flex: 1, backgroundColor: '#141c1b' },
  permiso: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo },
  permisoTexto: { textAlign: 'center', fontSize: 15, color: colores.tinta, marginBottom: 12 },
  indicacion: { position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: colores.blanco, fontSize: 14 },
  marco: { position: 'absolute', top: '25%', left: '10%', right: '10%', height: '35%', borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)', borderRadius: 16 },
  barra: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(13,19,18,0.85)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  lado: { width: 80 },
  cancelar: { color: colores.blanco, fontSize: 15 },
  derecha: { textAlign: 'right' },
  obturador: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colores.blanco,
    alignItems: 'center', justifyContent: 'center' },
  obturadorInterno: { width: 54, height: 54, borderRadius: 27, backgroundColor: colores.blanco },
});
