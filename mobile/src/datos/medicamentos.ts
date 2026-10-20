import { decode } from 'base64-arraybuffer';
import type { DatosMedicamento, Medicamento, ValoresFormulario } from '../dominio/tipos';
import { supabase } from './supabase';

const COLUMNAS =
  'id,nombre_comercial,principios_activos,dosis,forma,laboratorio,cantidad_envases,foto_path,creado_en,actualizado_en,actualizado_por_email';
const BUCKET = 'fotos';

export class ErrorDuplicado extends Error {
  constructor() {
    super('Ya existe un medicamento con ese nombre y dosis');
    this.name = 'ErrorDuplicado';
  }
}

function lanzar(error: { code?: string } | null): void {
  if (!error) return;
  if (error.code === '23505') throw new ErrorDuplicado();
  throw error;
}

export async function listarMedicamentos(): Promise<Medicamento[]> {
  const { data, error } = await supabase.from('medicamentos').select(COLUMNAS);
  lanzar(error);
  return (data ?? []) as Medicamento[];
}

export async function crearMedicamento(v: ValoresFormulario & { foto_path: string | null }): Promise<Medicamento> {
  const { data, error } = await supabase.from('medicamentos').insert(v).select(COLUMNAS).single();
  lanzar(error);
  return data as Medicamento;
}

export async function actualizarMedicamento(id: string, datos: DatosMedicamento): Promise<Medicamento> {
  const { data, error } = await supabase.from('medicamentos').update(datos).eq('id', id).select(COLUMNAS).single();
  lanzar(error);
  return data as Medicamento;
}

export async function ajustarEnvases(id: string, delta: number): Promise<Medicamento> {
  const { data, error } = await supabase.rpc('ajustar_envases', { p_id: id, p_delta: delta });
  lanzar(error);
  return data as Medicamento;
}

export async function subirFoto(base64: string): Promise<string> {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(base64), { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function eliminarFoto(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function eliminarMedicamento(m: Medicamento): Promise<void> {
  const { error } = await supabase.from('medicamentos').delete().eq('id', m.id);
  lanzar(error);
  if (m.foto_path) await eliminarFoto(m.foto_path).catch(() => undefined);
}

export async function urlsFirmadas(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error || !data) return {};
  const mapa: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
  return mapa;
}
