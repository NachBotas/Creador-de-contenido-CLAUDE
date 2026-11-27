import "server-only";
import { db } from "./supabase";
import { cifrar, descifrar } from "./cifrado";

// Cada negocio tiene su cuenta de ManyChat. La API permite buscar contactos de a uno y leer sus etiquetas,
// pero no listarlos todos ni leer conversaciones.

const API = "https://api.manychat.com";

export type Suscriptor = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  email?: string | null;
  phone?: string | null;
  ig_username?: string | null;
  subscribed?: string | null;
  last_interaction?: string | null;
  ig_last_interaction?: string | null;
  live_chat_url?: string | null;
  tags?: { id: number; name: string }[];
};

async function llamar<T>(token: string, ruta: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${API}${ruta}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; data?: T; message?: string; details?: { messages?: { message?: string }[] } };
  if (!res.ok || json.status !== "success") {
    throw new Error(json.details?.messages?.[0]?.message ?? json.message ?? `ManyChat respondió ${res.status}`);
  }
  return json.data as T;
}

export async function verificarToken(token: string): Promise<string> {
  const info = await llamar<{ name?: string }>(token, "/fb/page/getInfo");
  return info.name ?? "ManyChat";
}

export type Conexion = { id: string; negocio_id: string | null; nombre_pagina: string | null; secreto: string; created_at: string };

export async function conectarManychat(token: string, negocioId: string): Promise<string> {
  const nombre = await verificarToken(token);
  await db().from("manychat_conexiones").delete().eq("negocio_id", negocioId);
  const secreto = `rc_${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url")}`;
  const { error } = await db()
    .from("manychat_conexiones")
    .insert({ negocio_id: negocioId, nombre_pagina: nombre, token_cifrado: await cifrar(token), secreto });
  if (error) throw new Error(error.message);
  return nombre;
}

export async function conexionDeNegocio(negocioId: string): Promise<Conexion | null> {
  const { data } = await db()
    .from("manychat_conexiones")
    .select("id, negocio_id, nombre_pagina, secreto, created_at")
    .eq("negocio_id", negocioId)
    .maybeSingle();
  return data as Conexion | null;
}

async function tokenDe(negocioId: string): Promise<string> {
  const { data } = await db().from("manychat_conexiones").select("token_cifrado").eq("negocio_id", negocioId).maybeSingle();
  if (!data) throw new Error("Este negocio todavía no tiene ManyChat conectado");
  return descifrar((data as { token_cifrado: string }).token_cifrado);
}

// Acepta nombre, email, teléfono, ID de suscriptor o el link del chat de ManyChat.
export async function buscarContactos(negocioId: string, texto: string): Promise<Suscriptor[]> {
  const token = await tokenDe(negocioId);
  const q = texto.trim();
  const idEnLink = q.match(/\/chat\/(\d+)/)?.[1];
  if (idEnLink || /^\d{6,}$/.test(q)) {
    return [await llamar<Suscriptor>(token, "/fb/subscriber/getInfo", { subscriber_id: idEnLink ?? q })];
  }
  if (q.includes("@") && q.includes(".") && !q.startsWith("@")) {
    return llamar<Suscriptor[]>(token, "/fb/subscriber/findBySystemField", { email: q });
  }
  if (/^\+?[\d\s()-]{8,}$/.test(q)) {
    return llamar<Suscriptor[]>(token, "/fb/subscriber/findBySystemField", { phone: q.replace(/[\s()-]/g, "") });
  }
  const r = await llamar<Suscriptor[] | Suscriptor>(token, "/fb/subscriber/findByName", { name: q.replace(/^@/, "") });
  return Array.isArray(r) ? r : [r];
}

// Trae la ficha completa de ManyChat y la guarda (o actualiza) en la base.
export async function guardarContacto(negocioId: string, subscriberId: string): Promise<string> {
  const token = await tokenDe(negocioId);
  const s = await llamar<Suscriptor>(token, "/fb/subscriber/getInfo", { subscriber_id: subscriberId });
  const { data, error } = await db()
    .from("contactos")
    .upsert(
      {
        negocio_id: negocioId,
        subscriber_id: String(s.id),
        nombre: s.name || [s.first_name, s.last_name].filter(Boolean).join(" ") || null,
        ig_username: s.ig_username ?? null,
        foto_url: s.profile_pic ?? null,
        email: s.email ?? null,
        telefono: s.phone ?? null,
        etiquetas: (s.tags ?? []).map((t) => ({ id: t.id, name: t.name })),
        suscripto_en: s.subscribed ?? null,
        ultima_interaccion: s.ig_last_interaction ?? s.last_interaction ?? null,
        link_chat: s.live_chat_url ?? null,
        actualizado: new Date().toISOString(),
      },
      { onConflict: "negocio_id,subscriber_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export function tipoDeEtiqueta(etiqueta: string): "reel" | "historia" | "carrusel" | "otro" {
  const e = etiqueta.toLowerCase();
  if (e.startsWith("historia") || e.startsWith("story")) return "historia";
  if (e.startsWith("carrusel") || e.startsWith("carousel")) return "carrusel";
  if (e.startsWith("reel")) return "reel";
  return "otro";
}

export async function resumenConversaciones(conexionId: string, dias: number) {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("manychat_eventos")
    .select("etiqueta, created_at")
    .eq("conexion_id", conexionId)
    .gte("created_at", desde)
    .limit(50000);
  if (error) throw new Error(error.message);
  const eventos = (data ?? []) as { etiqueta: string; created_at: string }[];
  const porEtiqueta = new Map<string, number>();
  for (const e of eventos) porEtiqueta.set(e.etiqueta, (porEtiqueta.get(e.etiqueta) ?? 0) + 1);
  return { total: eventos.length, porEtiqueta: [...porEtiqueta.entries()].sort((a, b) => b[1] - a[1]) };
}
