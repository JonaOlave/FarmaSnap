import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { analizarFoto, analizarReceta } from '../src/datos/analizarFoto';
import { guardarCapturaPendiente } from '../src/datos/capturaTemporal';
import { LADO_RECETA } from '../src/datos/dimensiones';
import { mensajeErrorAnalisis } from '../src/datos/erroresFunciones';
import type { FotoPreparada } from '../src/datos/imagen';
import { useInventario } from '../src/datos/InventarioContext';
import { clasificarResultado } from '../src/dominio/clasificar';
import { clasificarReceta } from '../src/dominio/receta';
import type { Extraccion, FilaReceta, ResultadoBusqueda as Resultado } from '../src/dominio/tipos';
import { Boton } from '../src/ui/Boton';
import { CapturaFoto } from '../src/ui/CapturaFoto';
import { ResultadoBusqueda } from '../src/ui/ResultadoBusqueda';
import { ResultadoReceta } from '../src/ui/ResultadoReceta';
import { colores } from '../src/ui/tema';

type Paso =
  | { tipo: 'camara' }
  | { tipo: 'analizando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'resultado'; extraccion: Extraccion; resultado: Resultado; foto: FotoPreparada }
  | { tipo: 'receta'; filas: FilaReceta[] };

type Modo = 'caja' | 'receta';

export default function BuscarFoto() {
  const { medicamentos } = useInventario();
  const [paso, setPaso] = useState<Paso>({ tipo: 'camara' });
  const [modo, setModo] = useState<Modo>('caja');
  const abrir = (id: string) => router.push({ pathname: '/medicamento/[id]', params: { id } });

  async function alCapturarReceta(foto: FotoPreparada) {
    setPaso({ tipo: 'analizando' });
    try {
      const e = await analizarReceta(foto.base64);
      if (!e.es_receta || e.medicamentos.length === 0) {
        return setPaso({ tipo: 'error', mensaje: 'No encontré medicamentos en la receta. Prueba con más luz y la hoja completa.' });
      }
      setPaso({ tipo: 'receta', filas: clasificarReceta(e.medicamentos, medicamentos) });
    } catch (error) {
      setPaso({ tipo: 'error', mensaje: mensajeErrorAnalisis(error) });
    }
  }

  async function alCapturar(foto: FotoPreparada) {
    if (modo === 'receta') return alCapturarReceta(foto);
    setPaso({ tipo: 'analizando' });
    try {
      const e = await analizarFoto(foto.base64);
      if (!e.es_medicamento) return setPaso({ tipo: 'error', mensaje: 'La foto no parece ser de un medicamento.' });
      if (!e.legible) {
        return setPaso({ tipo: 'error', mensaje: 'No pude leer la caja. Prueba con más luz y encuadrando el frente.' });
      }
      const resultado = clasificarResultado(
        { nombre_comercial: e.nombre_comercial ?? '', principios_activos: e.principios_activos, dosis: e.dosis },
        medicamentos,
      );
      setPaso({ tipo: 'resultado', extraccion: e, resultado, foto });
    } catch (error) {
      setPaso({ tipo: 'error', mensaje: mensajeErrorAnalisis(error) });
    }
  }

  if (paso.tipo === 'camara') {
    const selector = (
      <View style={estilos.selector}>
        {(['caja', 'receta'] as const).map((m) => (
          <Pressable key={m} onPress={() => setModo(m)} style={[estilos.opcion, modo === m && estilos.opcionActiva]}>
            <Text style={[estilos.opcionTexto, modo === m && estilos.opcionTextoActivo]}>{m === 'caja' ? 'Caja' : 'Receta'}</Text>
          </Pressable>
        ))}
      </View>
    );
    return modo === 'receta'
      ? <CapturaFoto onCaptura={alCapturar} onCancelar={() => router.back()} superior={selector}
          indicacion="Fotografía la receta completa" marco="hoja" maximo={LADO_RECETA} />
      : <CapturaFoto onCaptura={alCapturar} onCancelar={() => router.back()} superior={selector}
          indicacion="Fotografía la caja que vas a comprar" />;
  }

  if (paso.tipo === 'analizando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={colores.marca} />
        <Text style={estilos.texto}>{modo === 'receta' ? 'Leyendo la receta…' : 'Buscando en el botiquín…'}</Text>
      </View>
    );
  }

  if (paso.tipo === 'error') {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.texto}>{paso.mensaje}</Text>
        <Boton titulo="Reintentar" onPress={() => setPaso({ tipo: 'camara' })} />
        <Boton titulo="Buscar escribiendo" variante="secundario" onPress={() => router.back()} />
      </View>
    );
  }

  if (paso.tipo === 'receta') {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <ResultadoReceta filas={paso.filas} onAbrir={abrir} />
        <Boton titulo="Escanear otra receta" variante="secundario" onPress={() => setPaso({ tipo: 'camara' })} />
        <Boton titulo="Volver" variante="secundario" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  const e = paso.extraccion;
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.buscado}>
        <Text style={estilos.buscadoNombre}>{[e.nombre_comercial, e.dosis].filter(Boolean).join(' ')}</Text>
        <Text style={estilos.buscadoDetalle}>{e.principios_activos.join(' + ') || 'Principio activo no leído'}</Text>
      </View>

      <ResultadoBusqueda resultado={paso.resultado} buscado={e}
        onAbrir={abrir} />

      <Boton titulo="Lo compré · registrar" variante="secundario" onPress={() => {
        guardarCapturaPendiente({ datos: e, foto: paso.foto });
        router.replace('/registrar');
      }} />
      <Boton titulo="Buscar otro" variante="secundario" onPress={() => setPaso({ tipo: 'camara' })} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo },
  texto: { textAlign: 'center', fontSize: 15, color: colores.tinta, marginVertical: 12 },
  contenido: { padding: 14, paddingBottom: 40 },
  buscado: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 14, padding: 12, marginBottom: 12 },
  buscadoNombre: { fontSize: 16, fontWeight: '700', color: colores.tinta },
  buscadoDetalle: { fontSize: 12, color: colores.suave, marginTop: 2 },
  selector: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(13,19,18,0.6)', borderRadius: 20, padding: 4 },
  opcion: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  opcionActiva: { backgroundColor: colores.blanco },
  opcionTexto: { color: colores.blanco, fontSize: 13, fontWeight: '600' },
  opcionTextoActivo: { color: colores.marcaOscuro },
});
