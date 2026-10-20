import { assertEquals } from "@std/assert";
import { crearHandler, type Dependencias } from "./handler.ts";
import type { Extraccion, ExtraccionReceta } from "./logica.ts";

const extraccion: Extraccion = {
  legible: true,
  es_medicamento: true,
  nombre_comercial: "Kitadol",
  principios_activos: ["paracetamol"],
  dosis: "500 mg",
  forma: "comprimidos",
  laboratorio: null,
};
const receta: ExtraccionReceta = {
  es_receta: true,
  medicamentos: [{ nombre: "Fesema", principios_activos: [], principios_deducidos: false, dosis: null, forma: null }],
};
const IMAGEN = "A".repeat(200);

function deps(cambios: Partial<Dependencias> = {}): Dependencias {
  return {
    usuarioDesdeToken: () => Promise.resolve("usuario-1"),
    registrarUso: () => Promise.resolve(true),
    extraer: () => Promise.resolve(extraccion),
    extraerReceta: () => Promise.resolve(receta),
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

function contando() {
  const n = { extraer: 0, extraerReceta: 0, usos: 0 };
  const d = deps({
    extraer: () => (n.extraer++, Promise.resolve(extraccion)),
    extraerReceta: () => (n.extraerReceta++, Promise.resolve(receta)),
    registrarUso: () => (n.usos++, Promise.resolve(true)),
  });
  return { n, d };
}

Deno.test("sin tipo usa la lectura de caja", async () => {
  const { n, d } = contando();
  assertEquals((await llamar(d, peticion({ imagen_base64: IMAGEN }))).cuerpo, extraccion);
  assertEquals([n.extraer, n.extraerReceta], [1, 0]);
});

Deno.test("tipo caja explícito usa la lectura de caja", async () => {
  const { n, d } = contando();
  assertEquals((await llamar(d, peticion({ imagen_base64: IMAGEN, tipo: "caja" }))).cuerpo, extraccion);
  assertEquals([n.extraer, n.extraerReceta], [1, 0]);
});

Deno.test("tipo receta usa extraerReceta y registra un uso", async () => {
  const { n, d } = contando();
  const r = await llamar(d, peticion({ imagen_base64: IMAGEN, tipo: "receta" }));
  assertEquals(r.estado, 200);
  assertEquals(r.cuerpo, receta);
  assertEquals([n.extraer, n.extraerReceta, n.usos], [0, 1, 1]);
});

Deno.test("400 tipo_invalido sin registrar uso", async () => {
  const { n, d } = contando();
  const r = await llamar(d, peticion({ imagen_base64: IMAGEN, tipo: "otro" }));
  assertEquals(r.estado, 400);
  assertEquals(r.cuerpo, { error: "tipo_invalido" });
  assertEquals(n.usos, 0);
});

Deno.test("502 si falla la lectura de la receta", async () => {
  const d = deps({ extraerReceta: () => Promise.reject(new Error("caída")) });
  const r = await llamar(d, peticion({ imagen_base64: IMAGEN, tipo: "receta" }));
  assertEquals(r.estado, 502);
  assertEquals(r.cuerpo, { error: "ia_no_disponible" });
});

Deno.test("un fallo de la IA no escribe el detalle del error en los logs", async () => {
  const original = console.error;
  const escrito: unknown[] = [];
  console.error = (...args: unknown[]) => escrito.push(...args);
  try {
    const d = deps({ extraerReceta: () => Promise.reject(new SyntaxError('Unexpected token "Fesema 2 puff"')) });
    await llamar(d, peticion({ imagen_base64: IMAGEN, tipo: "receta" }));
  } finally {
    console.error = original;
  }
  assertEquals(escrito.some((x) => String(x instanceof Error ? x.message : x).includes("Fesema")), false);
});
