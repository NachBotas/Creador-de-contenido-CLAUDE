import { NextResponse } from "next/server";
import { iniciarSincronizacion } from "@/lib/apify";

export const dynamic = "force-dynamic";

// Vercel llama a esta ruta una vez por día (ver vercel.json) con el CRON_SECRET.
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, mensaje: await iniciarSincronizacion() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
