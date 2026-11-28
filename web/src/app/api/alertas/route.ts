import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Nuevos virales (5x o más) que entraron desde una fecha. Protegida por el middleware.
export async function GET(req: Request) {
  const desdeTexto = new URL(req.url).searchParams.get("desde");
  const desde = desdeTexto && !Number.isNaN(Date.parse(desdeTexto)) ? desdeTexto : new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await db()
    .from("publicaciones")
    .select("id, outlier, miniatura_url, caption, tipo, referentes(ig_username)")
    .gte("outlier", 5)
    .gte("created_at", desde)
    .order("outlier", { ascending: false })
    .limit(12);
  return NextResponse.json(data ?? []);
}
