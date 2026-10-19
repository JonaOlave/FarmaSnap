import { assertEquals } from "@std/assert";
import { crearHandler, type Dependencias } from "./handler.ts";
import type { Extraccion } from "./logica.ts";

const extraccion: Extraccion = {
  legible: true,
  es_medicamento: true,
  nombre_comercial: "Kitadol",
  principios_activos: ["paracetamol"],
  dosis: "500 mg",
  forma: "comprimidos",
  laboratorio: null,
};
const IMAGEN = "A".repeat(200);

function deps(cambios: Partial<Dependencias> = {}): Dependencias {
  return {
    usuarioDesdeToken: () => Promise.resolve("usuario-1"),
    registrarUso: () => Promise.resolve(true),
    extraer: () => Promise.resolve(extraccion),
    ...cambios,
  };
}

function peticion(cuerpo: unknown, auth: string | null = "Bearer token", metodo = "POST") {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (auth) headers.set("Authorization", auth);
  return new Request("http://localhost/analizar-foto", {
    method: metodo,
    headers,
    body: metodo === "POST" ? (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) : undefined,
  });
}

async function llamar(d: Dependencias, req: Request) {
  const res = await crearHandler(d)(req);
  return { estado: res.status, cuerpo: await res.json() };
}

Deno.test("200 con la extracción cuando todo está bien", async () => {
  const r = await llamar(deps(), peticion({ imagen_base64: IMAGEN }));
  assertEquals(r.estado, 200);
  assertEquals(r.cuerpo, extraccion);
});

Deno.test("401 sin cabecera de autorización o con token inválido", async () => {
  assertEquals((await llamar(deps(), peticion({ imagen_base64: IMAGEN }, null))).estado, 401);
  const invalido = deps({ usuarioDesdeToken: () => Promise.resolve(null) });
  assertEquals((await llamar(invalido, peticion({ imagen_base64: IMAGEN }))).estado, 401);
});

Deno.test("405 con un método distinto de POST", async () => {
  assertEquals((await llamar(deps(), peticion(null, "Bearer token", "GET"))).estado, 405);
});

Deno.test("400 con cuerpo que no es JSON o sin imagen válida", async () => {
  assertEquals((await llamar(deps(), peticion("no-json"))).cuerpo, { error: "cuerpo_invalido" });
  assertEquals((await llamar(deps(), peticion({ imagen_base64: "x" }))).cuerpo, { error: "imagen_invalida" });
});

Deno.test("429 cuando se supera el límite diario, sin llamar a la IA", async () => {
  let llamoIa = false;
  const d = deps({
    registrarUso: () => Promise.resolve(false),
    extraer: () => {
      llamoIa = true;
      return Promise.resolve(extraccion);
    },
  });
  assertEquals((await llamar(d, peticion({ imagen_base64: IMAGEN }))).estado, 429);
  assertEquals(llamoIa, false);
});

Deno.test("502 cuando la IA falla", async () => {
  const d = deps({ extraer: () => Promise.reject(new Error("timeout")) });
  assertEquals((await llamar(d, peticion({ imagen_base64: IMAGEN }))).cuerpo, { error: "ia_no_disponible" });
});

Deno.test("500 cuando falla el registro de uso", async () => {
  const d = deps({ registrarUso: () => Promise.reject(new Error("db caída")) });
  assertEquals((await llamar(d, peticion({ imagen_base64: IMAGEN }))).estado, 500);
});
