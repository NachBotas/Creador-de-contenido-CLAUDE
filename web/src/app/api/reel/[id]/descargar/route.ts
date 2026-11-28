import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { chmod, copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { linksReel } from "@/lib/reels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Descarga de un reel como .mp4 que abre en cualquier reproductor.
// Si Instagram lo mandó en VP9 con el audio aparte, lo convertimos a H.264 + AAC con ffmpeg.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("No encontrado", { status: 404 });
  const nombre = new URL(req.url).searchParams.get("nombre")?.replace(/[^\w.@-]/g, "_") || `reel-${id}.mp4`;
  const cabeceras = { "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" };

  let links;
  try {
    links = await linksReel(id);
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }

  // Reel común (ya viene en MP4 con audio): lo pasamos tal cual.
  if (!links.audio) {
    const origen = await fetch(links.video, { cache: "no-store" }).catch(() => null);
    if (!origen?.ok || !origen.body) return new Response("No se pudo traer el video", { status: 502 });
    const largo = origen.headers.get("content-length");
    return new Response(origen.body, { headers: { ...cabeceras, ...(largo ? { "Content-Length": largo } : {}) } });
  }

  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  const limpiar = () => rm(dir, { recursive: true, force: true }).catch(() => undefined);
  try {
    const bajar = async (url: string, archivo: string) => {
      const r = await fetch(url, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) throw new Error("No se pudo traer el reel de Instagram");
      await writeFile(archivo, Buffer.from(await r.arrayBuffer()));
    };
    const video = path.join(dir, "v.mp4");
    const audio = path.join(dir, "a.mp4");
    const salida = path.join(dir, "salida.mp4");
    await Promise.all([bajar(links.video, video), bajar(links.audio, audio)]);
    const ffmpeg = await binarioFfmpeg(dir);
    await correr(ffmpeg, [
      "-v", "error", "-y",
      "-i", video, "-i", audio,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-vf", "scale='min(720,iw)':-2", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      salida,
    ]);
    const { size } = await stat(salida);
    const flujo = createReadStream(salida);
    flujo.on("close", limpiar);
    return new Response(Readable.toWeb(flujo) as ReadableStream, { headers: { ...cabeceras, "Content-Length": String(size) } });
  } catch (e) {
    await limpiar();
    return new Response((e as Error).message || "No se pudo convertir el reel", { status: 500 });
  }
}

async function binarioFfmpeg(dir: string): Promise<string> {
  const { path: original } = (await import("@ffmpeg-installer/ffmpeg")) as { path: string };
  try {
    await chmod(original, 0o755);
    return original;
  } catch {
    // En Vercel la carpeta del código es de solo lectura: lo copiamos a /tmp para poder ejecutarlo.
    const copia = path.join(dir, "ffmpeg");
    await copyFile(original, copia);
    await chmod(copia, 0o755);
    return copia;
  }
}

function correr(bin: string, args: string[]): Promise<void> {
  return new Promise((ok, mal) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    p.on("error", mal);
    p.on("close", (code) => (code === 0 ? ok() : mal(new Error(`La conversión falló: ${err.trim().split("\n").pop() ?? code}`))));
  });
}
