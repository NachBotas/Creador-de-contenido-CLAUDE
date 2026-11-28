import { urlVideoReel } from "@/lib/reels";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Video de un reel, pasando por la app (protegida por el middleware).
// Soporta adelantar/atrasar (Range) y ?descargar=1 para bajarlo como archivo.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("No encontrado", { status: 404 });
  let url: string;
  try {
    url = await urlVideoReel(id);
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
  const rango = req.headers.get("range");
  const origen = await fetch(url, { headers: rango ? { Range: rango } : {}, cache: "no-store" });
  if (!origen.ok || !origen.body) return new Response("No se pudo traer el video", { status: 502 });
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  const contentRange = origen.headers.get("content-range");
  if (contentRange) headers["Content-Range"] = contentRange;
  if (new URL(req.url).searchParams.get("descargar")) {
    const nombre = new URL(req.url).searchParams.get("nombre")?.replace(/[^\w.@-]/g, "_") || `reel-${id}.mp4`;
    headers["Content-Disposition"] = `attachment; filename="${nombre}"`;
  }
  return new Response(origen.body, { status: origen.status, headers });
}
