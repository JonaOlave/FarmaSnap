import {
  ESQUEMA,
  ESQUEMA_RECETA,
  type Extraccion,
  type ExtraccionReceta,
  INSTRUCCIONES,
  INSTRUCCIONES_RECETA,
  MODELO,
  validarExtraccion,
  validarReceta,
} from "./logica.ts";

/** Subconjunto del cliente de Anthropic que usamos; permite inyectar un cliente falso en pruebas. */
export interface ClienteMensajes {
  messages: {
    create(params: Record<string, unknown>): Promise<{
      stop_reason: string | null;
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}

export class ErrorExtraccion extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "ErrorExtraccion";
  }
}

async function pedir(
  cliente: ClienteMensajes,
  imagenBase64: string,
  system: string,
  schema: unknown,
  texto: string,
): Promise<unknown> {
  const respuesta = await cliente.messages.create({
    model: MODELO,
    max_tokens: 4000,
    system,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagenBase64 } },
        { type: "text", text: texto },
      ],
    }],
  });

  if (respuesta.stop_reason !== "end_turn") {
    throw new ErrorExtraccion(`stop_reason=${respuesta.stop_reason}`);
  }
  const bloque = respuesta.content.find((b) => b.type === "text");
  if (!bloque?.text) throw new ErrorExtraccion("sin_texto");
  return JSON.parse(bloque.text);
}

export async function extraerDeImagen(cliente: ClienteMensajes, imagenBase64: string): Promise<Extraccion> {
  return validarExtraccion(
    await pedir(cliente, imagenBase64, INSTRUCCIONES, ESQUEMA, "Extrae los datos de esta caja de medicamento."),
  );
}

export async function extraerReceta(cliente: ClienteMensajes, imagenBase64: string): Promise<ExtraccionReceta> {
  return validarReceta(
    await pedir(cliente, imagenBase64, INSTRUCCIONES_RECETA, ESQUEMA_RECETA, "Lista los medicamentos de esta receta."),
  );
}
