import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESION, invitacionValida, sesionValida } from "@/lib/auth";
import { urlAutorizacion } from "@/lib/instagram";

export const dynamic = "force-dynamic";

// Arranca el login oficial de Instagram. Lo puede usar quien tiene sesión o quien tiene un link de invitación.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const c = await cookies();
  const inv = url.searchParams.get("inv");
  const conSesion = await sesionValida(c.get(COOKIE_SESION)?.value);
  if (!conSesion && !(await invitacionValida(inv))) return NextResponse.redirect(new URL("/login", req.url));

  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
  try {
    const destino = urlAutorizacion(state);
    const res = NextResponse.redirect(destino);
    res.cookies.set("ig_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL(`/metricas?error=${encodeURIComponent((e as Error).message)}`, req.url));
  }
}
