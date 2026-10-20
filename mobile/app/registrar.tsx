import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { analizarFoto } from '../src/datos/analizarFoto';
import { leerCapturaPendiente, limpiarCapturaPendiente } from '../src/datos/capturaTemporal';
import { mensajeErrorAnalisis } from '../src/datos/erroresFunciones';
import type { FotoPreparada } from '../src/datos/imagen';
import { useInventario } from '../src/datos/InventarioContext';
import { crearMedicamento, eliminarFoto, ErrorDuplicado, subirFoto } from '../src/datos/medicamentos';
import { buscarDuplicado } from '../src/dominio/buscar';
import { textoCantidad, valoresDesdeExtraccion } from '../src/dominio/formato';
import type { Medicamento, ValoresFormulario } from '../src/dominio/tipos';
import { Boton } from '../src/ui/Boton';
import { CapturaFoto } from '../src/ui/CapturaFoto';
import { confirmar } from '../src/ui/confirmar';
import { FormularioMedicamento } from '../src/ui/FormularioMedicamento';
import { colores } from '../src/ui/tema';

const VACIO: ValoresFormulario = {
  nombre_comercial: '', principios_activos: [], dosis: null, forma: null, laboratorio: null, cantidad_envases: 1,
};

type Paso =
  | { tipo: 'camara' }
  | { tipo: 'analizando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'formulario'; inicial: ValoresFormulario; leidoPorIa: boolean; clave: number };

export default function Registrar() {
  const { medicamentos, recargar, ajustar } = useInventario();
  const [inicio] = useState(() => leerCapturaPendiente());
  const [foto, setFoto] = useState<FotoPreparada | null>(inicio?.foto ?? null);
  const [paso, setPaso] = useState<Paso>(
    inicio
      ? { tipo: 'formulario', inicial: valoresDesdeExtraccion(inicio.datos), leidoPorIa: true, clave: 0 }
      : { tipo: 'camara' },
  );
  const [guardando, setGuardando] = useState(false);
  const [duplicado, setDuplicado] = useState<{ existente: Medicamento; cantidad: number } | null>(null);

  useEffect(() => () => limpiarCapturaPendiente(), []);

  function mostrarFormulario(inicial: ValoresFormulario, leidoPorIa: boolean) {
    setPaso({ tipo: 'formulario', inicial, leidoPorIa, clave: Date.now() });
  }

  async function alCapturar(f: FotoPreparada) {
    setFoto(f);
    setPaso({ tipo: 'analizando' });
    try {
      const e = await analizarFoto(f.base64);
      if (!e.es_medicamento) return setPaso({ tipo: 'error', mensaje: 'La foto no parece ser de un medicamento.' });
      if (!e.legible) {
        return setPaso({ tipo: 'error', mensaje: 'No pude leer la caja. Prueba con más luz y encuadrando el frente.' });
      }
      mostrarFormulario(valoresDesdeExtraccion(e), true);
    } catch (error) {
      setPaso({ tipo: 'error', mensaje: mensajeErrorAnalisis(error) });
    }
  }

  async function guardar(v: ValoresFormulario) {
    const existente = buscarDuplicado(v, medicamentos);
    if (existente) return setDuplicado({ existente, cantidad: v.cantidad_envases });
    if (v.principios_activos.length === 0) {
      const seguir = await confirmar('Sin principio activo',
        'Sin principio activo no podré encontrar equivalentes. ¿Guardar igual?', 'Guardar');
      if (!seguir) return;
    }

    setGuardando(true);
    let fotoPath: string | null = null;
    try {
      if (foto) fotoPath = await subirFoto(foto.base64).catch(() => null); // sin foto si falla la subida
      await crearMedicamento({ ...v, foto_path: fotoPath });
      await recargar();
      router.back();
    } catch (error) {
      if (fotoPath) await eliminarFoto(fotoPath).catch(() => undefined);
      if (error instanceof ErrorDuplicado) {
        const lista = await recargar();
        const ex = buscarDuplicado(v, lista);
        if (ex) setDuplicado({ existente: ex, cantidad: v.cantidad_envases });
      } else {
        Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally {
      setGuardando(false);
    }
  }

  async function sumarAlExistente() {
    if (!duplicado) return;
    setGuardando(true);
    try {
      await ajustar(duplicado.existente.id, duplicado.cantidad);
      router.back();
    } catch {
      Alert.alert('No se pudo actualizar', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (paso.tipo === 'camara') {
    return <CapturaFoto onCaptura={alCapturar} onCancelar={() => router.back()} />;
  }

  if (paso.tipo === 'analizando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={colores.marca} />
        <Text style={estilos.texto}>Leyendo caja…</Text>
      </View>
    );
  }

  if (paso.tipo === 'error') {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.texto}>{paso.mensaje}</Text>
        <Boton titulo="Reintentar foto" onPress={() => setPaso({ tipo: 'camara' })} />
        <Boton titulo="Escribir a mano" variante="secundario" onPress={() => mostrarFormulario(VACIO, false)} />
      </View>
    );
  }

  const quedan = duplicado ? duplicado.existente.cantidad_envases + duplicado.cantidad : 0;
  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      {foto && (
        <View>
          <Image source={{ uri: foto.uri }} style={estilos.foto} />
          {paso.leidoPorIa && <Text style={estilos.insignia}>✦ Leído por IA · revisa los datos</Text>}
        </View>
      )}

      {duplicado && (
        <View style={estilos.duplicado}>
          <Text style={estilos.duplicadoTexto}>
            Ya tienes <Text style={{ fontWeight: '700' }}>{duplicado.existente.nombre_comercial} {duplicado.existente.dosis ?? ''}</Text>{' '}
            ({textoCantidad(duplicado.existente.cantidad_envases)}).
          </Text>
          <Boton titulo={`Sumar ${duplicado.cantidad} (quedan ${quedan})`} onPress={sumarAlExistente} cargando={guardando} />
          <Boton titulo="Editar datos" variante="secundario" onPress={() => setDuplicado(null)} />
        </View>
      )}

      {!duplicado && (
        <FormularioMedicamento key={paso.clave} inicial={paso.inicial} textoGuardar="Guardar"
          guardando={guardando} onGuardar={guardar} />
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo },
  texto: { textAlign: 'center', fontSize: 15, color: colores.tinta, marginVertical: 12 },
  contenido: { padding: 14, paddingBottom: 40 },
  foto: { height: 160, borderRadius: 14, marginBottom: 8, backgroundColor: colores.linea },
  insignia: { color: colores.marcaOscuro, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  duplicado: { backgroundColor: colores.eqClaro, borderRadius: 12, padding: 12, marginBottom: 10 },
  duplicadoTexto: { color: '#7a4e08', fontSize: 14 },
});
