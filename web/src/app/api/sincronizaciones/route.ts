import { NextResponse } from "next/server";
import { estadoSincronizaciones } from "@/lib/apify";

export const dynamic = "force-dynamic";

// Protegida por el middleware (requiere sesión).
export async function GET() {
  try {
    return NextResponse.json(await estadoSincronizaciones());
  } catch {
    return NextResponse.json([]);
  }
}
