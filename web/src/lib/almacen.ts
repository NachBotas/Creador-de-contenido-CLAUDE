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

// Sube bytes a R2 (con tamaño explícito: R2 lo exige) y devuelve la URL pública.
async function subirR2(ruta: string, datos: Uint8Array, tipo: string): Promise<string | null> {
  const url = `${process.env.R2_ENDPOINT!.replace(/\/$/, "")}/${R2_BUCKET}/${ruta}`;
  const cuerpo = datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength) as ArrayBuffer;
  const res = await r2().fetch(url, {
    method: "PUT",
    body: cuerpo,
    headers: { "Content-Type": tipo, "Content-Length": String(datos.byteLength), "Cache-Control": "public, max-age=31536000, immutable" },
  });
  if (!res.ok) {
    console.error(`[r2] PUT ${ruta} falló: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  return `${baseR2()}/${ruta}`;
}

// Guarda una imagen (achicada) y devuelve su URL pública.
export async function guardarImagen(ruta: string, original: Uint8Array): Promise<string | null> {
  const { datos, tipo } = await achicar(original);
  if (r2Configurado()) return subirR2(ruta, datos, tipo);
  const { error } = await db().storage.from(BUCKET).upload(ruta, datos, { contentType: tipo, upsert: true });
  if (error) return null;
  return db().storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

// Baja un video y lo guarda tal cual en R2 (solo si R2 está configurado).
export async function copiarVideo(url: string | undefined | null, ruta: string): Promise<string | null> {
  if (!url || !r2Configurado()) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await subirR2(ruta, new Uint8Array(await res.arrayBuffer()), "video/mp4");
  } catch {
    return null;
  }
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

// Mueve hasta `limite` imágenes de Supabase a R2 (de a 8 en paralelo), actualiza los links y borra las copias viejas.
export async function mudarImagenesAR2(limite = 300, limiteMs = 200_000): Promise<string> {
  if (!r2Configurado()) return "Cloudflare R2 no está configurado.";
  const empezo = Date.now();

  // 1) Juntar todas las filas que todavía apuntan a Supabase
  const filas: { tabla: string; columna: string; id: string; valor: string }[] = [];
  for (const { tabla, columna } of COLUMNAS) {
    const { data } = await db().from(tabla).select(`id, ${columna}`).like(columna, "%supabase.co/storage%").limit(2000);
    for (const f of (data ?? []) as unknown as Record<string, string>[]) filas.push({ tabla, columna, id: f.id, valor: f[columna] });
  }
  const urls = [...new Set(filas.map((f) => f.valor.split("?")[0]))];
  const tanda = urls.slice(0, limite);

  // 2) Copiar cada imagen a R2 (achicada)
  const nuevas = new Map<string, string>();
  const aBorrar: string[] = [];
  let i = 0;
  let fallidas = 0;
  console.log(`[mudanza] inicio: ${urls.length} imágenes en Supabase, esta tanda ${tanda.length}`);
  const trabajador = async () => {
    while (i < tanda.length && Date.now() - empezo < limiteMs) {
      const vieja = tanda[i++];
      const ruta = rutaDesdeUrl(vieja);
      if (!ruta) continue;
      try {
        const res = await fetch(vieja, { cache: "no-store" });
        if (!res.ok) {
          fallidas++;
          console.error(`[mudanza] no pude bajar ${ruta}: ${res.status}`);
          continue;
        }
        const guardada = await guardarImagen(ruta, new Uint8Array(await res.arrayBuffer()));
        if (guardada) {
          nuevas.set(vieja, guardada);
          aBorrar.push(ruta);
        } else fallidas++;
      } catch (e) {
        fallidas++;
        console.error(`[mudanza] error con ${ruta}: ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, trabajador));

  // 3) Actualizar los links en la base
  const cambios = filas.filter((f) => nuevas.has(f.valor.split("?")[0]));
  for (let k = 0; k < cambios.length; k += 10) {
    await Promise.all(
      cambios.slice(k, k + 10).map((f) => {
        const sufijo = f.valor.includes("?") ? `?${f.valor.split("?")[1]}` : "";
        return db().from(f.tabla).update({ [f.columna]: `${nuevas.get(f.valor.split("?")[0])}${sufijo}` }).eq("id", f.id);
      }),
    );
  }
  // 4) Borrar las copias viejas de Supabase
  for (let k = 0; k < aBorrar.length; k += 100) await db().storage.from(BUCKET).remove(aBorrar.slice(k, k + 100));

  const quedan = urls.length - nuevas.size;
  console.log(`[mudanza] fin: ${nuevas.size} mudadas, ${fallidas} fallidas, quedan ${quedan}, ${Math.round((Date.now() - empezo) / 1000)} s`);
  return quedan > 0 ? `Mudadas ${nuevas.size} imágenes a Cloudflare; quedan ${quedan}, se siguen mudando solas.` : `Listo: mudadas ${nuevas.size} imágenes a Cloudflare.`;
}
