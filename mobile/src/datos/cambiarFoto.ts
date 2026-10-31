interface Dependencias {
  subir: (base64: string) => Promise<string>;
  eliminar: (path: string) => Promise<void>;
  /** Guarda el medicamento; recibe la ruta de la foto nueva, o undefined para no tocarla. */
  guardar: (fotoPath: string | undefined) => Promise<void>;
}

/** Guarda cambiando la foto si hay una nueva: sube, guarda y recién entonces borra la anterior. */
export async function guardarConFoto(
  base64: string | null, anterior: string | null, { subir, eliminar, guardar }: Dependencias,
): Promise<void> {
  if (base64 === null) return guardar(undefined);
  const nueva = await subir(base64);
  try {
    await guardar(nueva);
  } catch (error) {
    await eliminar(nueva).catch(() => undefined);
    throw error;
  }
  if (anterior) await eliminar(anterior).catch(() => undefined);
}
