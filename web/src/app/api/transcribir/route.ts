import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { transcribirPublicacion } from "@/lib/apify";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Protegida por el middleware (requiere sesión).
export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Falta la publicación" }, { status: 400 });
  try {
    await transcribirPublicacion(id);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
