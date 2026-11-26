import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

// Cliente de servidor con la clave secreta. Nunca se manda al navegador.
export function db(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY");
  cliente = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: soloApikey },
  });
  return cliente;
}

// Las claves nuevas de Supabase (sb_secret_…) se mandan solo en el header "apikey".
// supabase-js además la repite como "Authorization: Bearer"; la sacamos para que viaje en un solo lugar.
const soloApikey: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  const apikey = headers.get("apikey");
  if (apikey?.startsWith("sb_") && headers.get("Authorization") === `Bearer ${apikey}`) headers.delete("Authorization");
  return fetch(input, { ...init, headers });
};

export const BUCKET = "medios";
