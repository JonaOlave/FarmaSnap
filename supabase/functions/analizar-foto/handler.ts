import { base64Valido, type Extraccion, type ExtraccionReceta } from "./logica.ts";

export interface Dependencias {
  /** Devuelve el id del usuario si el token es válido; null si no. */
  usuarioDesdeToken(authorization: string): Promise<string | null>;
  /** Suma un uso del día; true si sigue dentro del límite. */
  registrarUso(authorization: string): Promise<boolean>;
  extraer(imagenBase64: string): Promise<Extraccion>;
  extraerReceta(imagenBase64: string): Promise<ExtraccionReceta>;
}

function json(cuerpo: unknown, estado: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

export function crearHandler(deps: Dependencias) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

      const authorization = req.headers.get("Authorization");
      if (!authorization || !(await deps.usuarioDesdeToken(authorization))) {
        return json({ error: "no_autorizado" }, 401);
      }

      let cuerpo: unknown;
      try {
        cuerpo = await req.json();
      } catch {
        return json({ error: "cuerpo_invalido" }, 400);
      }
      const { imagen_base64: imagen, tipo = "caja" } = (cuerpo ?? {}) as { imagen_base64?: unknown; tipo?: unknown };
      if (!base64Valido(imagen)) return json({ error: "imagen_invalida" }, 400);
      if (tipo !== "caja" && tipo !== "receta") return json({ error: "tipo_invalido" }, 400);

      if (!(await deps.registrarUso(authorization))) return json({ error: "limite_diario" }, 429);

      try {
        return json(await (tipo === "receta" ? deps.extraerReceta(imagen) : deps.extraer(imagen)), 200);
      } catch (error) {
        console.error("Extracción fallida:", error);
        return json({ error: "ia_no_disponible" }, 502);
      }
    } catch (error) {
      console.error("Error interno:", error);
      return json({ error: "error_interno" }, 500);
    }
  };
}
