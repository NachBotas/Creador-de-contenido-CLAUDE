import "server-only";
import { db } from "./supabase";
import { cifrar } from "./cifrado";

// ManyChat no deja leer el historial: es cada flow el que nos avisa (paso "Solicitud externa").
// El token solo se usa para verificar la cuenta y mostrar su nombre.

export async function conectarManychat(token: string, cuentaId: string | null): Promise<string> {
  const res = await fetch("https://api.manychat.com/fb/page/getInfo", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { status?: string; data?: { name?: string }; message?: string };
  if (!res.ok || json.status !== "success") throw new Error(json.message ?? "ManyChat rechazó el token. Revisá que esté bien copiado.");
  const secreto = `rc_${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url")}`;
  const { error } = await db().from("manychat_conexiones").insert({
    cuenta_id: cuentaId,
    nombre_pagina: json.data?.name ?? null,
    token_cifrado: await cifrar(token),
    secreto,
  });
  if (error) throw new Error(error.message);
  return json.data?.name ?? "ManyChat";
}

export type Conexion = { id: string; cuenta_id: string | null; nombre_pagina: string | null; secreto: string; created_at: string };

export async function conexionDe(cuentaId: string): Promise<Conexion | null> {
  const { data } = await db()
    .from("manychat_conexiones")
    .select("id, cuenta_id, nombre_pagina, secreto, created_at")
    .eq("cuenta_id", cuentaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Conexion | null;
}

export function tipoDeEtiqueta(etiqueta: string): "reel" | "historia" | "carrusel" | "otro" {
  const e = etiqueta.toLowerCase();
  if (e.startsWith("historia") || e.startsWith("story")) return "historia";
  if (e.startsWith("carrusel") || e.startsWith("carousel")) return "carrusel";
  if (e.startsWith("reel") || e.includes("talking") || e.includes("miro") || e.includes("clip")) return "reel";
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
  const porTipo = new Map<string, number>();
  const porDia = new Map<string, number>();
  for (const e of eventos) {
    porEtiqueta.set(e.etiqueta, (porEtiqueta.get(e.etiqueta) ?? 0) + 1);
    const t = tipoDeEtiqueta(e.etiqueta);
    porTipo.set(t, (porTipo.get(t) ?? 0) + 1);
    const d = e.created_at.slice(0, 10);
    porDia.set(d, (porDia.get(d) ?? 0) + 1);
  }
  return {
    total: eventos.length,
    porEtiqueta: [...porEtiqueta.entries()].sort((a, b) => b[1] - a[1]),
    porTipo,
    porDia,
  };
}
