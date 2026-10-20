// Diagnóstico de lectura de recetas con fotos reales (consume crédito de Anthropic).
// Mismo cliente que index.ts (timeout 20 s, 1 reintento). Uso, desde la raíz del repositorio:
//   deno run --allow-env --allow-read --allow-net \
//     --config supabase/functions/analizar-foto/deno.json supabase/functions/analizar-foto/eval-receta.ts eval/fotos/receta-1-1568.jpg ...
import Anthropic from "@anthropic-ai/sdk";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { type ClienteMensajes, extraerReceta } from "./claude.ts";

const cliente = new Anthropic({ maxRetries: 1, timeout: 20_000 }) as unknown as ClienteMensajes;

for (const archivo of Deno.args) {
  const imagen = encodeBase64(await Deno.readFile(archivo));
  const inicio = Date.now();
  try {
    const r = await extraerReceta(cliente, imagen);
    console.log(`${archivo} (${Date.now() - inicio} ms):`, JSON.stringify(r, null, 2));
  } catch (error) {
    const e = error as { name?: string; message?: string; status?: number };
    console.log(`${archivo} (${Date.now() - inicio} ms) ERROR ${e.name} ${e.status ?? ""}: ${e.message}`);
  }
}
