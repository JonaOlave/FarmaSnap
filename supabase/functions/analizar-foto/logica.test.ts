import { assertEquals, assertThrows } from "@std/assert";
import { base64Valido, ESQUEMA, validarExtraccion } from "./logica.ts";

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
