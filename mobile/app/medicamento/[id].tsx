import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInventario } from '../../src/datos/InventarioContext';
import { actualizarMedicamento, eliminarMedicamento, ErrorDuplicado } from '../../src/datos/medicamentos';
import { buscarDuplicado } from '../../src/dominio/buscar';
import { detalleEnUso, textoCantidad } from '../../src/dominio/formato';
import type { ValoresFormulario } from '../../src/dominio/tipos';
import { ajustarEnvase } from '../../src/ui/ajustarEnvase';
import { Boton } from '../../src/ui/Boton';
import { confirmar } from '../../src/ui/confirmar';
import { FormularioMedicamento } from '../../src/ui/FormularioMedicamento';
import { colores } from '../../src/ui/tema';

export default function Detalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { medicamentos, fotos, sinConexion, ajustar, marcarEnUso, recargar } = useInventario();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const encontrado = medicamentos.find((m) => m.id === id);

  if (!encontrado) {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.texto}>Este medicamento ya no está en el inventario.</Text>
        <Boton titulo="Volver" onPress={() => router.back()} />
      </View>
    );
  }
  const m = encontrado;

  async function guardarEdicion(v: ValoresFormulario) {
    const otro = buscarDuplicado(v, medicamentos, m.id);
    if (otro) {
      Alert.alert('Ya existe', `Ya tienes ${otro.nombre_comercial} ${otro.dosis ?? ''}. Cambia el nombre o la dosis.`);
      return;
    }
    setGuardando(true);
    try {
      const { cantidad_envases: _sinUso, ...datos } = v;
      await actualizarMedicamento(m.id, datos);
      await recargar();
      setEditando(false);
    } catch (error) {
      Alert.alert(error instanceof ErrorDuplicado
        ? 'Ya existe un medicamento con ese nombre y dosis.'
        : 'No se pudo guardar. Revisa tu conexión.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!(await confirmar('Eliminar medicamento', `¿Eliminar ${m.nombre_comercial} del inventario?`, 'Eliminar'))) return;
    try {
      await eliminarMedicamento(m);
      await recargar();
      router.back();
    } catch {
      Alert.alert('No se pudo eliminar', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  function alAjustar(delta: number) {
    ajustarEnvase(m, delta, { ajustar, marcarEnUso });
  }

  function alternarEnUso() {
    marcarEnUso(m.id, !m.caja_en_uso).catch(() => Alert.alert('No se pudo actualizar', 'Revisa tu conexión.'));
  }

  const fotoUrl = m.foto_path ? fotos[m.foto_path] : undefined;
  const autor = m.actualizado_por_email?.split('@')[0];
  const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      {fotoUrl ? <Image source={{ uri: fotoUrl }} style={estilos.foto} /> : <View style={[estilos.foto, estilos.sinFoto]} />}

      {editando ? (
        <>
          <FormularioMedicamento inicial={m} mostrarCantidad={false} textoGuardar="Guardar cambios"
            guardando={guardando} onGuardar={guardarEdicion} />
          <Boton titulo="Cancelar" variante="secundario" onPress={() => setEditando(false)} />
        </>
      ) : (
        <>
          <View style={estilos.cabecera}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{[m.nombre_comercial, m.dosis].filter(Boolean).join(' ')}</Text>
              {m.laboratorio && <Text style={estilos.lab}>{m.laboratorio}</Text>}
            </View>
            <Pressable disabled={sinConexion} onPress={() => setEditando(true)}>
              <Text style={[estilos.editar, sinConexion && { opacity: 0.4 }]}>Editar</Text>
            </Pressable>
          </View>

          <View style={estilos.datos}>
            <Dato etiqueta="Principio activo" valor={m.principios_activos.join(', ') || '—'} />
            <Dato etiqueta="Forma" valor={m.forma ?? '—'} />
            <Dato etiqueta="Dosis" valor={m.dosis ?? '—'} />
            <Dato etiqueta="Registrado" valor={fecha(m.creado_en)} />
          </View>

          <View style={estilos.cantidad}>
            <View>
              <Text style={estilos.cantidadEtiqueta}>En casa</Text>
              <Text style={estilos.cantidadValor}>{textoCantidad(m.cantidad_envases)}</Text>
              {m.caja_en_uso && m.cantidad_envases > 0 && (
                <Text style={estilos.cantidadEtiqueta}>{detalleEnUso(m.cantidad_envases)}</Text>
              )}
            </View>
            <View style={estilos.pasos}>
              <Pressable accessibilityLabel="Restar un envase" disabled={sinConexion || m.cantidad_envases === 0}
                onPress={() => alAjustar(-1)} style={[estilos.paso, (sinConexion || m.cantidad_envases === 0) && { opacity: 0.4 }]}>
                <Text style={estilos.pasoTexto}>−</Text>
              </Pressable>
              <Pressable accessibilityLabel="Sumar un envase" disabled={sinConexion}
                onPress={() => alAjustar(1)} style={[estilos.paso, sinConexion && { opacity: 0.4 }]}>
                <Text style={estilos.pasoTexto}>+</Text>
              </Pressable>
            </View>
          </View>

          {m.cantidad_envases > 0 && (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: m.caja_en_uso, disabled: sinConexion }}
              disabled={sinConexion} onPress={alternarEnUso} style={[estilos.enUso, sinConexion && { opacity: 0.4 }]}>
              <View style={[estilos.casilla, m.caja_en_uso && estilos.casillaMarcada]}>
                {m.caja_en_uso && <Text style={estilos.check}>✓</Text>}
              </View>
              <Text style={estilos.enUsoTexto}>Hay una caja en uso</Text>
            </Pressable>
          )}

          <Text style={estilos.auditoria}>
            Último cambio: {autor ?? 'desconocido'} · {fecha(m.actualizado_en)}
          </Text>
          <Boton titulo="Eliminar medicamento" variante="peligro" deshabilitado={sinConexion} onPress={eliminar} />
        </>
      )}
    </ScrollView>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.dato}>
      <Text style={estilos.datoEtiqueta}>{etiqueta.toUpperCase()}</Text>
      <Text style={estilos.datoValor}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo },
  texto: { textAlign: 'center', fontSize: 15, color: colores.tinta, marginBottom: 12 },
  contenido: { padding: 14, paddingBottom: 40 },
  foto: { height: 200, borderRadius: 16, marginBottom: 12, backgroundColor: colores.linea },
  sinFoto: { backgroundColor: colores.marcaClaro },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start' },
  nombre: { fontSize: 22, fontWeight: '700', color: colores.tinta },
  lab: { fontSize: 13, color: colores.suave, marginTop: 2 },
  editar: { color: colores.marca, fontWeight: '600', fontSize: 15 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  dato: { width: '48%', backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 12, padding: 10 },
  datoEtiqueta: { fontSize: 10, fontWeight: '600', color: colores.suave },
  datoValor: { fontSize: 14, fontWeight: '600', color: colores.tinta, marginTop: 2 },
  cantidad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colores.marcaClaro, borderRadius: 14, padding: 12 },
  cantidadEtiqueta: { fontSize: 12, color: colores.marcaOscuro },
  cantidadValor: { fontSize: 22, fontWeight: '700', color: colores.marcaOscuro },
  pasos: { flexDirection: 'row', gap: 10 },
  paso: { width: 42, height: 42, borderRadius: 12, backgroundColor: colores.blanco, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { fontSize: 22, fontWeight: '700', color: colores.marcaOscuro },
  enUso: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4 },
  casilla: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colores.marca,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colores.blanco },
  casillaMarcada: { backgroundColor: colores.marca },
  check: { color: colores.blanco, fontSize: 15, fontWeight: '700' },
  enUsoTexto: { fontSize: 15, color: colores.tinta },
  auditoria: { textAlign: 'center', fontSize: 12, color: colores.suave, marginVertical: 12 },
});
