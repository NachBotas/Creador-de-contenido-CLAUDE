import { NextResponse } from "next/server";
import { urlAutorizacionDrive } from "@/lib/drive";

export const dynamic = "force-dynamic";

// Protegida por el middleware: solo con sesión.
export async function GET(req: Request) {
  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
  try {
    const res = NextResponse.redirect(urlAutorizacionDrive(state));
    res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL(`/referentes?error=${encodeURIComponent((e as Error).message)}`, req.url));
  }
}
