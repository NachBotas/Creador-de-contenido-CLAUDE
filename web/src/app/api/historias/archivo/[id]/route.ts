import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Descarga un archivo de una historia pasando por la app (protegida por el middleware: requiere sesión).
// Se usa si el navegador no puede bajarlo directo de Cloudflare.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("No encontrado", { status: 404 });
  const tipo = new URL(req.url).searchParams.get("tipo");
  const { data } = await db().from("historias").select("media_url, miniatura_url, tipo_media").eq("id", id).maybeSingle();
  const h = data as { media_url: string | null; miniatura_url: string | null; tipo_media: string | null } | null;
  const url = tipo === "imagen" ? h?.miniatura_url : (h?.media_url ?? h?.miniatura_url);
  if (!url) return new Response("Archivo no disponible", { status: 404 });
  const origen = await fetch(url, { cache: "no-store" });
  if (!origen.ok || !origen.body) return new Response("Archivo no disponible", { status: 404 });
  return new Response(origen.body, {
    headers: {
      // Sin Content-Length: la respuesta va en streaming (Vercel no limita el tamaño así).
      "Content-Type": origen.headers.get("content-type") ?? "application/octet-stream",
    },
  });
}
