// Evaluación manual con fotos reales (consume crédito de Anthropic).
// Uso, desde la raíz del repositorio:
//   ANTHROPIC_API_KEY=... deno run --allow-env --allow-read --allow-net \
//     --config supabase/functions/analizar-foto/deno.json supabase/functions/analizar-foto/eval.ts eval
import Anthropic from "@anthropic-ai/sdk";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { type ClienteMensajes, extraerDeImagen } from "./claude.ts";

interface Esperado {
  archivo: string;
  nombre_comercial: string;
  principios_activos: string[];
  dosis: string | null;
}

const norm = (t: string | null | undefined) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "").trim();
const mismoConjunto = (a: string[], b: string[]) =>
  a.length === b.length && a.map(norm).sort().join("|") === b.map(norm).sort().join("|");

const carpeta = Deno.args[0] ?? "eval";
const casos: Esperado[] = JSON.parse(await Deno.readTextFile(`${carpeta}/esperado.json`));
const cliente = new Anthropic() as unknown as ClienteMensajes;

let aciertosNombre = 0, aciertosPrincipios = 0, aciertosDosis = 0;
for (const caso of casos) {
  const imagen = encodeBase64(await Deno.readFile(`${carpeta}/fotos/${caso.archivo}`));
  try {
    const r = await extraerDeImagen(cliente, imagen);
    const n = norm(r.nombre_comercial) === norm(caso.nombre_comercial);
    const p = mismoConjunto(r.principios_activos, caso.principios_activos);
    const d = norm(r.dosis) === norm(caso.dosis);
    aciertosNombre += Number(n);
    aciertosPrincipios += Number(p);
    aciertosDosis += Number(d);
    console.log(`${n && p && d ? "✔" : "✘"} ${caso.archivo}: ${r.nombre_comercial} | ${r.principios_activos.join("+")} | ${r.dosis}`);
  } catch (error) {
    console.log(`✘ ${caso.archivo}: error ${error}`);
  }
}
const pct = (x: number) => `${Math.round((100 * x) / casos.length)}%`;
console.log(`\nNombre: ${pct(aciertosNombre)} · Principio activo: ${pct(aciertosPrincipios)} · Dosis: ${pct(aciertosDosis)}`);
