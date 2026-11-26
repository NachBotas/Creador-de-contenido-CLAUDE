import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, sesionValida } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (await sesionValida(req.cookies.get(COOKIE_SESION)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

// Todo protegido menos el login, el cron, el webhook de Apify y los archivos estáticos.
export const config = {
  matcher: ["/((?!login|api/cron|api/apify|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
