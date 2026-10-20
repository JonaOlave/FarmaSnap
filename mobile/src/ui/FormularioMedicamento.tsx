import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parsearPrincipios, textoOpcional } from '../dominio/formato';
import type { ValoresFormulario } from '../dominio/tipos';
import { Boton } from './Boton';
import { colores } from './tema';

interface Props {
  inicial: ValoresFormulario;
  mostrarCantidad?: boolean;
  textoGuardar: string;
  guardando: boolean;
  onGuardar: (valores: ValoresFormulario) => void;
}

export function FormularioMedicamento({ inicial, mostrarCantidad = true, textoGuardar, guardando, onGuardar }: Props) {
  const [nombre, setNombre] = useState(inicial.nombre_comercial);
  const [principios, setPrincipios] = useState(inicial.principios_activos.join(', '));
  const [dosis, setDosis] = useState(inicial.dosis ?? '');
  const [forma, setForma] = useState(inicial.forma ?? '');
  const [laboratorio, setLaboratorio] = useState(inicial.laboratorio ?? '');
  const [cantidad, setCantidad] = useState(inicial.cantidad_envases);

  function guardar() {
    onGuardar({
      nombre_comercial: textoOpcional(nombre) ?? '',
      principios_activos: parsearPrincipios(principios),
      dosis: textoOpcional(dosis),
      forma: textoOpcional(forma)?.toLowerCase() ?? null,
      laboratorio: textoOpcional(laboratorio),
      cantidad_envases: cantidad,
    });
  }

  return (
    <View>
      <Campo etiqueta="Nombre comercial *" valor={nombre} onCambio={setNombre} ejemplo="Kitadol" />
      <Campo etiqueta="Principio activo (separa con comas)" valor={principios} onCambio={setPrincipios}
        ejemplo="paracetamol" minusculas />
      <View style={estilos.fila}>
        <View style={{ flex: 1 }}><Campo etiqueta="Dosis" valor={dosis} onCambio={setDosis} ejemplo="500 mg" /></View>
        <View style={{ flex: 1 }}><Campo etiqueta="Forma" valor={forma} onCambio={setForma} ejemplo="comprimidos" minusculas /></View>
      </View>
      <Campo etiqueta="Laboratorio" valor={laboratorio} onCambio={setLaboratorio} ejemplo="Laboratorio Chile" />

      {mostrarCantidad && (
        <View style={estilos.cantidad}>
          <Text style={estilos.etiqueta}>ENVASES</Text>
          <View style={estilos.pasos}>
            <Pressable accessibilityLabel="Menos envases" onPress={() => setCantidad((c) => Math.max(1, c - 1))} style={estilos.paso}>
              <Text style={estilos.pasoTexto}>−</Text>
            </Pressable>
            <Text style={estilos.numero}>{cantidad}</Text>
            <Pressable accessibilityLabel="Más envases" onPress={() => setCantidad((c) => c + 1)} style={estilos.paso}>
              <Text style={estilos.pasoTexto}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Boton titulo={textoGuardar} onPress={guardar} cargando={guardando} deshabilitado={!textoOpcional(nombre)} />
    </View>
  );
}

function Campo(props: { etiqueta: string; valor: string; onCambio: (t: string) => void; ejemplo: string; minusculas?: boolean }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={estilos.etiqueta}>{props.etiqueta.toUpperCase()}</Text>
      <TextInput style={estilos.campo} value={props.valor} onChangeText={props.onCambio} placeholder={props.ejemplo}
        autoCapitalize={props.minusculas ? 'none' : 'sentences'} />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 8 },
  etiqueta: { fontSize: 11, fontWeight: '600', color: colores.suave, letterSpacing: 0.4 },
  campo: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 11,
    paddingHorizontal: 11, paddingVertical: 9, fontSize: 15, marginTop: 3 },
  cantidad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 },
  pasos: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  paso: { width: 38, height: 38, borderRadius: 10, backgroundColor: colores.marcaClaro, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { fontSize: 20, fontWeight: '700', color: colores.marcaOscuro },
  numero: { fontSize: 18, fontWeight: '700', color: colores.tinta, minWidth: 24, textAlign: 'center' },
});
