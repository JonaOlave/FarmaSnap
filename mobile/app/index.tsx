import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventario } from '../src/datos/InventarioContext';
import { supabase } from '../src/datos/supabase';
import { buscarPorTexto } from '../src/dominio/buscar';
import type { Medicamento } from '../src/dominio/tipos';
import { AvisoConexion } from '../src/ui/AvisoConexion';
import { confirmar } from '../src/ui/confirmar';
import { MedicamentoItem } from '../src/ui/MedicamentoItem';
import { colores } from '../src/ui/tema';

type Filtro = 'todos' | 'con' | 'sin';

export default function Inventario() {
  const { medicamentos, fotos, cargando, sinConexion, actualizadoEn, recargar, ajustar } = useInventario();
  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [refrescando, setRefrescando] = useState(false);
  const margen = useSafeAreaInsets();

  const visibles = useMemo(
    () =>
      buscarPorTexto(consulta, medicamentos).filter(
        (m) => filtro === 'todos' || (filtro === 'con' ? m.cantidad_envases > 0 : m.cantidad_envases === 0),
      ),
    [consulta, filtro, medicamentos],
  );
  const conStock = medicamentos.filter((m) => m.cantidad_envases > 0).length;

  function alAjustar(m: Medicamento, delta: number) {
    const hacer = () =>
      ajustar(m.id, delta).catch(() => Alert.alert('No se pudo actualizar', 'Revisa tu conexión e inténtalo de nuevo.'));
    if (delta < 0 && m.cantidad_envases === 1) {
      confirmar('¿Se acabó?', `${m.nombre_comercial} quedará como "Sin stock".`, 'Sí, se acabó').then((ok) => {
        if (ok) hacer();
      });
    } else {
      hacer();
    }
  }

  async function salir() {
    if (await confirmar('Cerrar sesión', '¿Quieres cerrar sesión en este teléfono?', 'Cerrar sesión')) {
      await supabase.auth.signOut();
    }
  }

  async function refrescar() {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  }

  const filtros: Array<[Filtro, string]> = [
    ['todos', `Todos · ${medicamentos.length}`],
    ['con', `Con stock · ${conStock}`],
    ['sin', `Sin stock · ${medicamentos.length - conStock}`],
  ];

  return (
    <View style={estilos.pantalla}>
      <Stack.Screen options={{ headerRight: () => <Pressable onPress={salir}><Text style={estilos.salir}>Salir</Text></Pressable> }} />

      <View style={estilos.busqueda}>
        <TextInput style={estilos.campo} placeholderTextColor={colores.suave} value={consulta} onChangeText={setConsulta}
          placeholder="Buscar por nombre o componente…" clearButtonMode="while-editing" />
        <Pressable accessibilityLabel="Buscar por foto" disabled={sinConexion}
          onPress={() => router.push('/buscar-foto')} style={[estilos.camara, sinConexion && estilos.inactivo]}>
          <Text style={estilos.camaraTexto}>📷</Text>
        </Pressable>
      </View>

      <View style={estilos.chips}>
        {filtros.map(([clave, texto]) => (
          <Pressable key={clave} onPress={() => setFiltro(clave)} style={[estilos.chip, filtro === clave && estilos.chipActivo]}>
            <Text style={[estilos.chipTexto, filtro === clave && estilos.chipTextoActivo]}>{texto}</Text>
          </Pressable>
        ))}
      </View>

      <AvisoConexion sinConexion={sinConexion} actualizadoEn={actualizadoEn} />

      <FlatList
        data={visibles}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        contentContainerStyle={{ paddingBottom: 96 }}
        ListEmptyComponent={
          <Text style={estilos.vacio}>
            {cargando ? 'Cargando…' : consulta ? 'No hay coincidencias en casa.' : 'Aún no hay medicamentos. Registra el primero.'}
          </Text>
        }
        renderItem={({ item }) => (
          <MedicamentoItem
            medicamento={item}
            fotoUrl={item.foto_path ? fotos[item.foto_path] : undefined}
            deshabilitado={sinConexion}
            onAjustar={(delta) => alAjustar(item, delta)}
            onPress={() => router.push({ pathname: '/medicamento/[id]', params: { id: item.id } })}
          />
        )}
      />

      <Pressable disabled={sinConexion} onPress={() => router.push('/registrar')}
        style={[estilos.fab, { bottom: 24 + margen.bottom }, sinConexion && estilos.inactivo]}>
        <Text style={estilos.fabTexto}>+  Registrar</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, paddingHorizontal: 14, paddingTop: 10, backgroundColor: colores.fondo },
  salir: { color: colores.marcaOscuro, fontWeight: '600' },
  busqueda: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  campo: { flex: 1, color: colores.tinta, backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  camara: { width: 48, borderRadius: 14, backgroundColor: colores.marca, alignItems: 'center', justifyContent: 'center' },
  camaraTexto: { fontSize: 20 },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea },
  chipActivo: { backgroundColor: colores.marcaClaro, borderColor: 'transparent' },
  chipTexto: { fontSize: 12, color: colores.suave },
  chipTextoActivo: { color: colores.marcaOscuro, fontWeight: '600' },
  vacio: { textAlign: 'center', color: colores.suave, marginTop: 40 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: colores.marca, paddingHorizontal: 20,
    paddingVertical: 14, borderRadius: 18, elevation: 4 },
  fabTexto: { color: colores.blanco, fontWeight: '700', fontSize: 15 },
  inactivo: { opacity: 0.5 },
});
