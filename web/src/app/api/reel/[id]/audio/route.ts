import { linksReel } from "@/lib/reels";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Audio de un reel que viene separado del video (formato DASH de Instagram).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("No encontrado", { status: 404 });
  let url: string | null;
  try {
    url = (await linksReel(id)).audio;
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
  if (!url) return new Response("Este reel no tiene audio aparte", { status: 404 });
  const rango = req.headers.get("range");
  const origen = await fetch(url, { headers: rango ? { Range: rango } : {}, cache: "no-store" });
  if (!origen.ok || !origen.body) return new Response("No se pudo traer el audio", { status: 502 });
  const headers: Record<string, string> = { "Content-Type": "audio/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  const contentRange = origen.headers.get("content-range");
  if (contentRange) headers["Content-Range"] = contentRange;
  const largo = origen.headers.get("content-length");
  if (largo) headers["Content-Length"] = largo;
  if (new URL(req.url).searchParams.get("descargar")) {
    const nombre = new URL(req.url).searchParams.get("nombre")?.replace(/[^\w.@-]/g, "_") || `reel-${id}.m4a`;
    headers["Content-Disposition"] = `attachment; filename="${nombre}"`;
  }
  return new Response(origen.body, { status: origen.status, headers });
}
