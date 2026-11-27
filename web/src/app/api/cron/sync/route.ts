import { NextResponse } from "next/server";
import { completarPortadas, iniciarSincronizacion, leerSyncDiaria } from "@/lib/apify";
import { instagramConfigurado, sincronizarTodasLasCuentas } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel llama a esta ruta una vez por día (ver vercel.json) con el CRON_SECRET.
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const resultado: Record<string, unknown> = {};
  try {
    resultado.referentes = await iniciarSincronizacion(await leerSyncDiaria());
  } catch (e) {
    resultado.errorReferentes = (e as Error).message;
  }
  try {
    resultado.portadas = await completarPortadas(40);
  } catch (e) {
    resultado.errorPortadas = (e as Error).message;
  }
  if (instagramConfigurado()) resultado.cuentasActualizadas = await sincronizarTodasLasCuentas();
  return NextResponse.json({ ok: !resultado.errorReferentes, ...resultado });
}
