import { ESQUEMA, type Extraccion, INSTRUCCIONES, MODELO, validarExtraccion } from "./logica.ts";

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

export async function extraerDeImagen(cliente: ClienteMensajes, imagenBase64: string): Promise<Extraccion> {
  const respuesta = await cliente.messages.create({
    model: MODELO,
    max_tokens: 4000,
    system: INSTRUCCIONES,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagenBase64 } },
        { type: "text", text: "Extrae los datos de esta caja de medicamento." },
      ],
    }],
  });

  if (respuesta.stop_reason !== "end_turn") {
    throw new ErrorExtraccion(`stop_reason=${respuesta.stop_reason}`);
  }
  const bloque = respuesta.content.find((b) => b.type === "text");
  if (!bloque?.text) throw new ErrorExtraccion("sin_texto");
  return validarExtraccion(JSON.parse(bloque.text));
}
