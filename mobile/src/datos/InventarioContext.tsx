import NetInfo from '@react-native-community/netinfo';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Medicamento } from '../dominio/tipos';
import { guardarCache, leerCache } from './cache';
import { ajustarEnvases, listarMedicamentos, urlsFirmadas } from './medicamentos';
import { supabase } from './supabase';

interface ValorInventario {
  medicamentos: Medicamento[];
  /** foto_path -> URL firmada (válida 1 hora) */
  fotos: Record<string, string>;
  cargando: boolean;
  sinConexion: boolean;
  /** ISO de los datos mostrados (última carga correcta o caché) */
  actualizadoEn: string | null;
  recargar: () => Promise<Medicamento[]>;
  ajustar: (id: string, delta: number) => Promise<void>;
}

const Contexto = createContext<ValorInventario | null>(null);

export function InventarioProvider({ activo, children }: { activo: boolean; children: ReactNode }) {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);

  const recargar = useCallback(async (): Promise<Medicamento[]> => {
    try {
      const lista = await listarMedicamentos();
      const ahora = new Date();
      setMedicamentos(lista);
      setActualizadoEn(ahora.toISOString());
      await guardarCache(lista, ahora);
      const paths = lista.map((m) => m.foto_path).filter((p): p is string => !!p);
      setFotos(await urlsFirmadas(paths));
      return lista;
    } catch {
      const cache = await leerCache();
      if (cache) {
        setMedicamentos(cache.medicamentos);
        setActualizadoEn(cache.guardadoEn);
        return cache.medicamentos;
      }
      return [];
    } finally {
      setCargando(false);
    }
  }, []);

  const ajustar = useCallback(async (id: string, delta: number) => {
    const actualizado = await ajustarEnvases(id, delta);
    setMedicamentos((lista) => {
      const nueva = lista.map((m) => (m.id === id ? actualizado : m));
      guardarCache(nueva);
      return nueva;
    });
  }, []);

  useEffect(() => {
    if (!activo) {
      setMedicamentos([]);
      return;
    }
    // Mostrar la caché al instante mientras llega la lista real.
    leerCache().then((cache) => {
      if (cache) {
        setMedicamentos((actual) => (actual.length > 0 ? actual : cache.medicamentos));
        setActualizadoEn((actual) => actual ?? cache.guardadoEn);
      }
    });
    recargar();
    const canal = supabase
      .channel('medicamentos-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicamentos' }, () => {
        recargar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [activo, recargar]);

  useEffect(() => {
    return NetInfo.addEventListener((estado) => {
      const desconectado = estado.isConnected === false;
      setSinConexion(desconectado);
      if (!desconectado && activo) recargar();
    });
  }, [activo, recargar]);

  const valor = useMemo(
    () => ({ medicamentos, fotos, cargando, sinConexion, actualizadoEn, recargar, ajustar }),
    [medicamentos, fotos, cargando, sinConexion, actualizadoEn, recargar, ajustar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useInventario(): ValorInventario {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useInventario debe usarse dentro de InventarioProvider');
  return valor;
}
