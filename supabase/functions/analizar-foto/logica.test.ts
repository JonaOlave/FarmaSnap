import { assertEquals, assertThrows } from "@std/assert";
import { base64Valido, ESQUEMA, ESQUEMA_RECETA, validarExtraccion, validarReceta } from "./logica.ts";

const completa = {
  legible: true,
  es_medicamento: true,
  nombre_comercial: " Kitadol ",
  principios_activos: ["Paracetamol"],
  dosis: "500 mg",
  forma: "Comprimidos",
  laboratorio: "Laboratorio Chile",
};

Deno.test("validarExtraccion recorta textos y normaliza principios y forma", () => {
  assertEquals(validarExtraccion(completa), {
    legible: true,
    es_medicamento: true,
    nombre_comercial: "Kitadol",
    principios_activos: ["paracetamol"],
    dosis: "500 mg",
    forma: "comprimidos",
    laboratorio: "Laboratorio Chile",
  });
});

Deno.test("validarExtraccion elimina principios vacíos, repetidos y no textuales", () => {
  const r = validarExtraccion({
    ...completa,
    principios_activos: ["Paracetamol", " paracetamol ", "", 42, "Cafeína"],
  });
  assertEquals(r.principios_activos, ["paracetamol", "cafeína"]);
});

Deno.test("sin nombre comercial la extracción no es legible", () => {
  const r = validarExtraccion({ ...completa, nombre_comercial: null });
  assertEquals(r.legible, false);
  assertEquals(r.nombre_comercial, null);
});

Deno.test("textos vacíos se convierten en null", () => {
  const r = validarExtraccion({ ...completa, dosis: "  ", forma: "", laboratorio: null });
  assertEquals([r.dosis, r.forma, r.laboratorio], [null, null, null]);
});

Deno.test("una respuesta que no es objeto se rechaza", () => {
  assertThrows(() => validarExtraccion("hola"), Error, "respuesta_invalida");
  assertThrows(() => validarExtraccion(null), Error, "respuesta_invalida");
});

Deno.test("el esquema cumple las reglas de salida estructurada", () => {
  assertEquals(ESQUEMA.additionalProperties, false);
  assertEquals([...ESQUEMA.required].sort(), Object.keys(ESQUEMA.properties).sort());
});

Deno.test("base64Valido acepta imágenes y rechaza valores inválidos", () => {
  assertEquals(base64Valido("A".repeat(200)), true);
  assertEquals(base64Valido("corto"), false);
  assertEquals(base64Valido(123), false);
  assertEquals(base64Valido("%%%" + "A".repeat(200)), false);
});

const itemReceta = (nombre: string, cambios: Record<string, unknown> = {}) => ({
  nombre,
  principios_activos: [],
  principios_deducidos: false,
  dosis: null,
  forma: null,
  ...cambios,
});

Deno.test("validarReceta recorta, normaliza y descarta ítems sin nombre", () => {
  const r = validarReceta({
    es_receta: true,
    medicamentos: [
      itemReceta(" Fesema ", { principios_activos: ["Salbutamol"], principios_deducidos: true, forma: "Inhalador" }),
      itemReceta("  "),
    ],
  });
  assertEquals(r, {
    es_receta: true,
    medicamentos: [{
      nombre: "Fesema",
      principios_activos: ["salbutamol"],
      principios_deducidos: true,
      dosis: null,
      forma: "inhalador",
    }],
  });
});

Deno.test("validarReceta deduplica por nombre normalizado", () => {
  const r = validarReceta({
    es_receta: true,
    medicamentos: [itemReceta("Coritex forte", { dosis: "1" }), itemReceta("CORITEX FORTE"), itemReceta("Fesema")],
  });
  assertEquals(r.medicamentos.map((m) => [m.nombre, m.dosis]), [["Coritex forte", "1"], ["Fesema", null]]);
});

Deno.test("validarReceta exige principios para marcar deducidos", () => {
  const r = validarReceta({ es_receta: true, medicamentos: [itemReceta("Fesema", { principios_deducidos: true })] });
  assertEquals(r.medicamentos[0].principios_deducidos, false);
});

Deno.test("validarReceta con es_receta false devuelve lista vacía y rechaza datos inválidos", () => {
  assertEquals(validarReceta({ es_receta: false, medicamentos: [itemReceta("Fesema")] }), {
    es_receta: false,
    medicamentos: [],
  });
  for (const malo of [null, [], "x"]) assertThrows(() => validarReceta(malo));
});

Deno.test("ESQUEMA_RECETA exige todas sus propiedades y no admite extras", () => {
  assertEquals(ESQUEMA_RECETA.additionalProperties, false);
  assertEquals([...ESQUEMA_RECETA.required].sort(), Object.keys(ESQUEMA_RECETA.properties).sort());
  const item = ESQUEMA_RECETA.properties.medicamentos.items;
  assertEquals(item.additionalProperties, false);
  assertEquals([...item.required].sort(), Object.keys(item.properties).sort());
});

Deno.test("validarReceta mantiene el mismo medicamento con dosis distintas", () => {
  const r = validarReceta({
    es_receta: true,
    medicamentos: [itemReceta("Paracetamol", { dosis: "500 mg" }), itemReceta("paracetamol", { dosis: "1 g" })],
  });
  assertEquals(r.medicamentos.map((m) => m.dosis), ["500 mg", "1 g"]);
});
