import "server-only";
import { db } from "./supabase";

export type CuentaIg = {
  id: string;
  username: string;
  nombre: string | null;
  foto_url: string | null;
  seguidores: number | null;
  seguidos: number | null;
  cantidad_posts: number | null;
  token_expira: string | null;
  ultima_sync: string | null;
  ultimo_error: string | null;
};

export type Diaria = { fecha: string; seguidores: number | null; nuevos_seguidores: number | null; alcance: number | null };
export type PostPropio = {
  id: string;
  tipo: string | null;
  permalink: string | null;
  caption: string | null;
  fecha: string | null;
  miniatura_url: string | null;
  likes: number | null;
  comentarios: number | null;
  alcance: number | null;
  vistas: number | null;
  guardados: number | null;
  compartidos: number | null;
  interacciones: number | null;
};

const CAMPOS = "id, username, nombre, foto_url, seguidores, seguidos, cantidad_posts, token_expira, ultima_sync, ultimo_error";

export async function listarCuentas(): Promise<CuentaIg[]> {
  const { data, error } = await db().from("cuentas_ig").select(CAMPOS).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as CuentaIg[];
}

export async function diariasDe(cuentaId: string, dias: number): Promise<Diaria[]> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await db()
    .from("metricas_diarias")
    .select("fecha, seguidores, nuevos_seguidores, alcance")
    .eq("cuenta_id", cuentaId)
    .gte("fecha", desde)
    .order("fecha");
  if (error) throw new Error(error.message);
  return (data ?? []) as Diaria[];
}

export async function demografiaDe(cuentaId: string) {
  const { data, error } = await db().from("demografia").select("dimension, clave, valor, actualizado").eq("cuenta_id", cuentaId);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as { dimension: string; clave: string; valor: number; actualizado: string }[];
  const por = (d: string) => filas.filter((f) => f.dimension === d).sort((a, b) => b.valor - a.valor);
  return { genero: por("genero"), edad: por("edad").sort((a, b) => a.clave.localeCompare(b.clave)), pais: por("pais"), ciudad: por("ciudad"), actualizado: filas[0]?.actualizado ?? null };
}

export async function postsDe(cuentaId: string): Promise<PostPropio[]> {
  const { data, error } = await db().from("posts_propios").select("*").eq("cuenta_id", cuentaId).order("fecha", { ascending: false }).limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []) as PostPropio[];
}
