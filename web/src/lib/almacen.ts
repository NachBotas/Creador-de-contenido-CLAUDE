import "server-only";
import { AwsClient } from "aws4fetch";
import sharp from "sharp";
import { db, BUCKET } from "./supabase";

// Dónde se guardan las imágenes: Cloudflare R2 si está configurado; si no, Supabase Storage.
// Todas se achican antes de guardarse (máx. 720 px de ancho, JPEG calidad 72) para ocupar poco.

const R2_BUCKET = process.env.R2_BUCKET || "radar-medios";

export function r2Configurado(): boolean {
  return Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_PUBLIC_URL);
}

let cliente: AwsClient | null = null;
function r2(): AwsClient {
  if (!cliente) {
    cliente = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: "s3",
      region: "auto",
    });
  }
  return cliente;
}

const baseR2 = () => (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

// ¿La imagen ya está guardada por nosotros (en Supabase o en R2)?
export function esPropia(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("supabase.co/storage") || (r2Configurado() && url.startsWith(baseR2()));
}

export function estaEnSupabase(url: string | null | undefined): boolean {
  return Boolean(url?.includes("supabase.co/storage"));
}

async function achicar(bytes: Uint8Array): Promise<{ datos: Uint8Array; tipo: string }> {
  try {
    const salida = await sharp(bytes).rotate().resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    return { datos: new Uint8Array(salida), tipo: "image/jpeg" };
  } catch {
    return { datos: bytes, tipo: "image/jpeg" };
  }
}

// Guarda una imagen y devuelve su URL pública.
export async function guardarImagen(ruta: string, original: Uint8Array): Promise<string | null> {
  const { datos, tipo } = await achicar(original);
  if (r2Configurado()) {
    const url = `${process.env.R2_ENDPOINT!.replace(/\/$/, "")}/${R2_BUCKET}/${ruta}`;
    const res = await r2().fetch(url, {
      method: "PUT",
      body: new Blob([datos as BlobPart], { type: tipo }),
      headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) return null;
    return `${baseR2()}/${ruta}`;
  }
  const { error } = await db().storage.from(BUCKET).upload(ruta, datos, { contentType: tipo, upsert: true });
  if (error) return null;
  return db().storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

// Baja una imagen de internet y la guarda (achicada).
export async function copiarImagen(url: string | undefined | null, ruta: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await guardarImagen(ruta, new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

// ---------- Mudanza de Supabase a Cloudflare R2 ----------

const COLUMNAS: { tabla: string; columna: string }[] = [
  { tabla: "publicaciones", columna: "miniatura_url" },
  { tabla: "historias", columna: "miniatura_url" },
  { tabla: "historias", columna: "media_url" },
  { tabla: "referentes", columna: "foto_url" },
  { tabla: "cuentas_ig", columna: "foto_url" },
];

function rutaDesdeUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/[^/]+\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Mueve hasta `limite` imágenes de Supabase a R2, actualiza los links y borra las copias viejas.
export async function mudarImagenesAR2(limite = 300, limiteMs = 200_000): Promise<string> {
  if (!r2Configurado()) return "Cloudflare R2 no está configurado.";
  const empezo = Date.now();
  const nuevas = new Map<string, string>(); // url vieja -> url nueva
  const aBorrar: string[] = [];
  let movidas = 0;
  let quedan = 0;

  for (const { tabla, columna } of COLUMNAS) {
    const { data } = await db().from(tabla).select(`id, ${columna}`).like(columna, "%supabase.co/storage%").limit(limite);
    const filas = (data ?? []) as unknown as Record<string, string>[];
    for (const fila of filas) {
      if (movidas >= limite || Date.now() - empezo > limiteMs) {
        quedan++;
        continue;
      }
      const vieja = fila[columna].split("?")[0];
      let nueva = nuevas.get(vieja);
      if (!nueva) {
        const ruta = rutaDesdeUrl(vieja);
        if (!ruta) continue;
        try {
          const res = await fetch(vieja, { cache: "no-store" });
          if (!res.ok) continue;
          const guardada = await guardarImagen(ruta, new Uint8Array(await res.arrayBuffer()));
          if (!guardada) continue;
          nueva = guardada;
          nuevas.set(vieja, nueva);
          aBorrar.push(ruta);
          movidas++;
        } catch {
          continue;
        }
      }
      const sufijo = fila[columna].includes("?") ? `?${fila[columna].split("?")[1]}` : "";
      await db().from(tabla).update({ [columna]: `${nueva}${sufijo}` }).eq("id", fila.id);
    }
  }
  for (let i = 0; i < aBorrar.length; i += 100) await db().storage.from(BUCKET).remove(aBorrar.slice(i, i + 100));
  return quedan ? `Mudadas ${movidas} imágenes a Cloudflare; quedan más, se siguen mudando solas.` : `Mudadas ${movidas} imágenes a Cloudflare.`;
}
