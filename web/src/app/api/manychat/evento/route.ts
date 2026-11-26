import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Cada flow de ManyChat avisa acá cuando alguien entra (paso "Solicitud externa").
export async function POST(req: Request) {
  const secreto = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!secreto?.startsWith("rc_")) return NextResponse.json({ error: "Falta el secreto" }, { status: 401 });
  const { data: conexion } = await db().from("manychat_conexiones").select("id").eq("secreto", secreto).maybeSingle();
  if (!conexion) return NextResponse.json({ error: "Secreto inválido" }, { status: 401 });

  const cuerpo = (await req.json().catch(() => null)) as { etiqueta?: unknown; subscriber_id?: unknown } | null;
  const etiqueta = String(cuerpo?.etiqueta ?? "").trim().toLowerCase().slice(0, 80);
  const suscriptor = String(cuerpo?.subscriber_id ?? "").trim().slice(0, 64);
  if (!etiqueta || !suscriptor || suscriptor.includes("{{")) {
    return NextResponse.json({ error: "Faltan etiqueta o subscriber_id (elegí «Id de contacto» desde el selector de ManyChat)" }, { status: 400 });
  }
  const { error } = await db()
    .from("manychat_eventos")
    .upsert({ conexion_id: (conexion as { id: string }).id, etiqueta, subscriber_id: suscriptor }, { onConflict: "conexion_id,etiqueta,subscriber_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
