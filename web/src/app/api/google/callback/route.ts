import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { conectarDriveConCodigo } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const c = await cookies();
  const volver = (q: string) => {
    const res = NextResponse.redirect(new URL(`/referentes?${q}#drive`, req.url));
    res.cookies.delete("g_state");
    return res;
  };
  if (!url.searchParams.get("state") || url.searchParams.get("state") !== c.get("g_state")?.value) return volver(`error=${encodeURIComponent("El enlace venció. Volvé a tocar «Conectar Google Drive».")}`);
  if (url.searchParams.get("error")) return volver(`error=${encodeURIComponent("Se canceló la conexión con Google.")}`);
  try {
    await conectarDriveConCodigo(url.searchParams.get("code") ?? "");
    return volver(`msg=${encodeURIComponent("Google Drive conectado. Las historias nuevas se guardan en la carpeta «Radar – Historias».")}`);
  } catch (e) {
    return volver(`error=${encodeURIComponent((e as Error).message)}`);
  }
}
