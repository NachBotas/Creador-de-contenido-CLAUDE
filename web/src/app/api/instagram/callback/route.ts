import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESION, sesionValida } from "@/lib/auth";
import { conectarConCodigo } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Instagram vuelve acá después de que la cuenta autoriza.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const c = await cookies();
  const conSesion = await sesionValida(c.get(COOKIE_SESION)?.value);
  const volver = (ruta: string) => {
    const res = NextResponse.redirect(new URL(ruta, req.url));
    res.cookies.delete("ig_state");
    return res;
  };
  const fallo = (msg: string) => volver(conSesion ? `/metricas?error=${encodeURIComponent(msg)}` : `/conectar/listo?error=${encodeURIComponent(msg)}`);

  const state = url.searchParams.get("state");
  if (!state || state !== c.get("ig_state")?.value) return fallo("El enlace venció. Volvé a tocar «Conectar».");
  if (url.searchParams.get("error")) return fallo("La conexión se canceló en Instagram.");
  const code = url.searchParams.get("code");
  if (!code) return fallo("Instagram no devolvió la autorización.");

  try {
    const id = await conectarConCodigo(code.replace(/#_$/, ""));
    return volver(conSesion ? `/metricas/${id}?msg=${encodeURIComponent("Cuenta conectada.")}` : "/conectar/listo");
  } catch (e) {
    return fallo((e as Error).message);
  }
}
