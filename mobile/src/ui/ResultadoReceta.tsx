import { Pressable, StyleSheet, Text, View } from 'react-native';
import { textoCantidad } from '../dominio/formato';
import type { FilaReceta, Medicamento } from '../dominio/tipos';
import { colores } from './tema';

interface Props {
  filas: FilaReceta[];
  onAbrir: (id: string) => void;
}

function nombreCompleto(m: Medicamento): string {
  return [m.nombre_comercial, m.dosis].filter(Boolean).join(' ');
}

function Fila({ fila, onAbrir }: { fila: FilaReceta; onAbrir: (id: string) => void }) {
  const { recetado: r, estado } = fila;
  const nombre = <Text style={estilos.nombre}>{[r.nombre, r.dosis].filter(Boolean).join(' ')}</Text>;

  if (estado.tipo === 'en_casa') {
    const m = estado.medicamento;
    return (
      <Pressable onPress={() => onAbrir(m.id)} style={[estilos.tarjeta, { backgroundColor: colores.okClaro }]}>
        {nombre}
        <Text style={[estilos.estado, { color: colores.ok }]}>✓ En casa · {textoCantidad(m.cantidad_envases)}</Text>
      </Pressable>
    );
  }

  if (estado.tipo === 'similar') {
    return (
      <View style={[estilos.tarjeta, { backgroundColor: colores.eqClaro }]}>
        {nombre}
        <Text style={[estilos.estado, { color: colores.eq }]}>≈ Similar en casa</Text>
        {estado.coincidencias.map(({ medicamento: m, dosisDistinta }) => (
          <Pressable key={m.id} onPress={() => onAbrir(m.id)} style={estilos.coincidencia}>
            <Text style={estilos.texto}><Text style={estilos.negrita}>{nombreCompleto(m)}</Text>: {textoCantidad(m.cantidad_envases)}</Text>
            {dosisDistinta && <Text style={estilos.aviso}>⚠ Dosis distinta</Text>}
          </Pressable>
        ))}
        {r.principios_deducidos && (
          <Text style={estilos.sub}>Según la IA contiene {r.principios_activos.join(' + ')}</Text>
        )}
      </View>
    );
  }

  if (estado.tipo === 'sin_stock') {
    return (
      <Pressable onPress={() => onAbrir(estado.medicamento.id)} style={[estilos.tarjeta, { backgroundColor: colores.noClaro }]}>
        {nombre}
        <Text style={[estilos.estado, { color: colores.no }]}>Registrado, sin stock</Text>
      </Pressable>
    );
  }

  return (
    <View style={[estilos.tarjeta, estilos.noRegistrado]}>
      {nombre}
      <Text style={[estilos.estado, { color: colores.suave }]}>No registrado</Text>
      {r.principios_activos.length > 0 && <Text style={estilos.sub}>{r.principios_activos.join(' + ')}</Text>}
    </View>
  );
}

export function ResultadoReceta({ filas, onAbrir }: Props) {
  return (
    <View>
      <Text style={estilos.encabezado}>
        Receta · {filas.length} {filas.length === 1 ? 'medicamento' : 'medicamentos'}
      </Text>
      {filas.map((fila, i) => <Fila key={`${i}-${fila.recetado.nombre}`} fila={fila} onAbrir={onAbrir} />)}
    </View>
  );
}

const estilos = StyleSheet.create({
  encabezado: { fontSize: 16, fontWeight: '700', color: colores.tinta, marginBottom: 10 },
  tarjeta: { borderRadius: 16, padding: 14, marginBottom: 10 },
  noRegistrado: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea },
  nombre: { fontSize: 15, fontWeight: '700', color: colores.tinta },
  estado: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  texto: { fontSize: 14, color: colores.tinta },
  negrita: { fontWeight: '700' },
  coincidencia: { paddingVertical: 6 },
  sub: { fontSize: 12, color: colores.suave, marginTop: 2 },
  aviso: { fontSize: 12, color: '#7a4e08', marginTop: 4 },
});
