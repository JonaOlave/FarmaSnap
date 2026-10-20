import { assertEquals, assertRejects } from "@std/assert";
import { type ClienteMensajes, ErrorExtraccion, extraerDeImagen, extraerReceta } from "./claude.ts";
import { ESQUEMA_RECETA, INSTRUCCIONES_RECETA, MODELO } from "./logica.ts";

function clienteFalso(respuesta: { stop_reason: string | null; content: Array<{ type: string; text?: string }> }) {
  const llamadas: Record<string, unknown>[] = [];
  const cliente: ClienteMensajes = {
    messages: {
      create(params) {
        llamadas.push(params);
        return Promise.resolve(respuesta);
      },
    },
  };
  return { cliente, llamadas };
}

const json = JSON.stringify({
  legible: true,
  es_medicamento: true,
  nombre_comercial: "Kitadol",
  principios_activos: ["Paracetamol"],
  dosis: "500 mg",
  forma: "comprimidos",
  laboratorio: null,
});

Deno.test("envía la imagen al modelo correcto con salida estructurada", async () => {
  const { cliente, llamadas } = clienteFalso({ stop_reason: "end_turn", content: [{ type: "text", text: json }] });
  const r = await extraerDeImagen(cliente, "QUJD");
  assertEquals(r.nombre_comercial, "Kitadol");
  assertEquals(r.principios_activos, ["paracetamol"]);
  const p = llamadas[0] as {
    model: string;
    output_config: { effort: string; format: { type: string } };
    messages: Array<{ content: Array<{ type: string; source?: { data: string; media_type: string } }> }>;
  };
  assertEquals(p.model, MODELO);
  assertEquals(p.output_config.effort, "low");
  assertEquals(p.output_config.format.type, "json_schema");
  const imagen = p.messages[0].content.find((b) => b.type === "image");
  assertEquals(imagen?.source?.data, "QUJD");
  assertEquals(imagen?.source?.media_type, "image/jpeg");
});

Deno.test("ignora bloques que no son de texto", async () => {
  const { cliente } = clienteFalso({
    stop_reason: "end_turn",
    content: [{ type: "thinking" }, { type: "text", text: json }],
  });
  assertEquals((await extraerDeImagen(cliente, "QUJD")).dosis, "500 mg");
});

Deno.test("una negativa o una respuesta cortada es un error", async () => {
  for (const stop_reason of ["refusal", "max_tokens"]) {
    const { cliente } = clienteFalso({ stop_reason, content: [{ type: "text", text: "{" }] });
    await assertRejects(() => extraerDeImagen(cliente, "QUJD"), ErrorExtraccion);
  }
});

Deno.test("una respuesta sin texto es un error", async () => {
  const { cliente } = clienteFalso({ stop_reason: "end_turn", content: [] });
  await assertRejects(() => extraerDeImagen(cliente, "QUJD"), ErrorExtraccion);
});

const jsonReceta = JSON.stringify({
  es_receta: true,
  medicamentos: [{ nombre: "Ibuprofeno forte", principios_activos: ["Ibuprofeno"], principios_deducidos: false, dosis: "200 mg/5 ml", forma: "suspensión" }],
});

Deno.test("extraerReceta envía la imagen con las instrucciones y el esquema de receta", async () => {
  const { cliente, llamadas } = clienteFalso({ stop_reason: "end_turn", content: [{ type: "text", text: jsonReceta }] });
  const r = await extraerReceta(cliente, "QUJD");
  assertEquals(r.medicamentos[0].principios_activos, ["ibuprofeno"]);
  const p = llamadas[0] as {
    model: string;
    system: string;
    output_config: { format: { schema: unknown } };
    messages: Array<{ content: Array<{ type: string; source?: { data: string } }> }>;
  };
  assertEquals(p.model, MODELO);
  assertEquals(p.system, INSTRUCCIONES_RECETA);
  assertEquals(p.output_config.format.schema, ESQUEMA_RECETA);
  assertEquals(p.messages[0].content.find((b) => b.type === "image")?.source?.data, "QUJD");
});

Deno.test("extraerReceta: una negativa o una respuesta cortada es un error", async () => {
  for (const stop_reason of ["refusal", "max_tokens"]) {
    const { cliente } = clienteFalso({ stop_reason, content: [{ type: "text", text: "{" }] });
    await assertRejects(() => extraerReceta(cliente, "QUJD"), ErrorExtraccion);
  }
});
