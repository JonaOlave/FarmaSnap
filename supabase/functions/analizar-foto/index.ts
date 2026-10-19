import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { type ClienteMensajes, extraerDeImagen } from "./claude.ts";
import { crearHandler } from "./handler.ts";
import { LIMITE_DIARIO } from "./logica.ts";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
  maxRetries: 1, // un reintento ante 429/5xx/red
  timeout: 20_000, // milisegundos
});

function clienteDelUsuario(authorization: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(crearHandler({
  async usuarioDesdeToken(authorization) {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data, error } = await clienteDelUsuario(authorization).auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async registrarUso(authorization) {
    const { data, error } = await clienteDelUsuario(authorization).rpc("registrar_uso_ia", {
      p_limite: LIMITE_DIARIO,
    });
    if (error) throw error;
    return data === true;
  },
  extraer: (imagen) => extraerDeImagen(anthropic as unknown as ClienteMensajes, imagen),
}));
