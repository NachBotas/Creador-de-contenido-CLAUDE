import "server-only";
import { db } from "./supabase";

export const MAX_NEGOCIOS = 5;

export type Negocio = { id: string; nombre: string; ig_username: string | null; orden: number };

export async function listarNegocios(): Promise<Negocio[]> {
  const { data, error } = await db().from("negocios").select("id, nombre, ig_username, orden").order("orden").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Negocio[];
}

export type Contacto = {
  id: string;
  negocio_id: string;
  subscriber_id: string;
  nombre: string | null;
  ig_username: string | null;
  foto_url: string | null;
  email: string | null;
  telefono: string | null;
  etiquetas: { id: number; name: string }[];
  suscripto_en: string | null;
  ultima_interaccion: string | null;
  link_chat: string | null;
  cerrado: boolean;
  fecha_cierre: string | null;
  monto: number | null;
  nota: string | null;
  actualizado: string;
};

export async function listarContactos(negocioId?: string): Promise<Contacto[]> {
  let q = db().from("contactos").select("*").order("cerrado", { ascending: false }).order("fecha_cierre", { ascending: false, nullsFirst: false }).order("actualizado", { ascending: false }).limit(2000);
  if (negocioId) q = q.eq("negocio_id", negocioId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Contacto[];
}

export async function obtenerContacto(id: string): Promise<Contacto | null> {
  const { data, error } = await db().from("contactos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Contacto | null;
}
