import { Pressable, StyleSheet, Text, View } from 'react-native';
import { textoCantidad } from '../dominio/formato';
import type { Extraccion, Medicamento, ResultadoBusqueda as Resultado } from '../dominio/tipos';
import { colores } from './tema';

interface Props {
  resultado: Resultado;
  buscado: Extraccion;
  onAbrir: (id: string) => void;
}

function nombreCompleto(m: Medicamento): string {
  return [m.nombre_comercial, m.dosis].filter(Boolean).join(' ');
}

export function ResultadoBusqueda({ resultado, buscado, onAbrir }: Props) {
  if (resultado.tipo === 'tiene') {
    const m = resultado.medicamento;
    return (
      <Pressable onPress={() => onAbrir(m.id)} style={[estilos.tarjeta, { backgroundColor: colores.okClaro }]}>
        <Text style={[estilos.titulo, { color: colores.ok }]}>✓ Ya lo tienes</Text>
        <Text style={estilos.texto}><Text style={estilos.negrita}>{nombreCompleto(m)}</Text>: {textoCantidad(m.cantidad_envases)} en casa</Text>
      </Pressable>
    );
  }

  if (resultado.tipo === 'equivalente') {
    return (
      <View style={[estilos.tarjeta, { backgroundColor: colores.eqClaro }]}>
        <Text style={[estilos.titulo, { color: colores.eq }]}>≈ Tienes un equivalente</Text>
        {resultado.coincidencias.map(({ medicamento: m, dosisDistinta }) => (
          <Pressable key={m.id} onPress={() => onAbrir(m.id)} style={estilos.coincidencia}>
            <Text style={estilos.texto}><Text style={estilos.negrita}>{nombreCompleto(m)}</Text>: {textoCantidad(m.cantidad_envases)}</Text>
            <Text style={estilos.sub}>Mismo principio activo: {m.principios_activos.join(' + ')}</Text>
            {dosisDistinta && <Text style={estilos.aviso}>⚠ Dosis distinta: tú buscas {buscado.dosis ?? 'otra dosis'}</Text>}
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={[estilos.tarjeta, { backgroundColor: colores.noClaro }]}>
      <Text style={[estilos.titulo, { color: colores.no }]}>✕ No lo tienes en casa</Text>
      {resultado.agotado && (
        <Text style={estilos.texto}>Lo tenían ({nombreCompleto(resultado.agotado)}), pero se acabó.</Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderRadius: 16, padding: 14, marginBottom: 10 },
  titulo: { fontWeight: '700', fontSize: 16, marginBottom: 6 },
  texto: { fontSize: 14, color: colores.tinta },
  negrita: { fontWeight: '700' },
  coincidencia: { paddingVertical: 6 },
  sub: { fontSize: 12, color: colores.suave, marginTop: 2 },
  aviso: { fontSize: 12, color: '#7a4e08', marginTop: 4 },
});
