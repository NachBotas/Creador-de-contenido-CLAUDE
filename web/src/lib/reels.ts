import "server-only";
import { db } from "./supabase";
import { videoSinAudio } from "./video";

// El link de video de Instagram vence (parámetro "oe" = fecha de vencimiento en hexadecimal).
function vigente(url: string | null): boolean {
  if (!url) return false;
  try {
    const oe = new URL(url).searchParams.get("oe");
    if (!oe) return true;
    return parseInt(oe, 16) * 1000 > Date.now() + 10 * 60_000;
  } catch {
    return false;
  }
}

export type LinksReel = { video: string; audio: string | null };

// Devuelve links vigentes del video (y del audio, si viene aparte). Si vencieron, pide nuevos a Apify (US$ 0,0027) y los guarda.
export async function linksReel(id: string): Promise<LinksReel> {
  const { data } = await db().from("publicaciones").select("ig_id, tipo, media_url, audio_url").eq("id", id).maybeSingle();
  const p = data as { ig_id: string; tipo: string; media_url: string | null; audio_url: string | null } | null;
  if (!p) throw new Error("No encontré ese reel");
  if (p.tipo !== "reel") throw new Error("Solo los reels tienen video");
  const aparte = videoSinAudio(p.media_url);
  if (vigente(p.media_url) && (!aparte || vigente(p.audio_url))) return { video: p.media_url!, audio: aparte ? p.audio_url : null };

  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Falta APIFY_TOKEN");
  const res = await fetch("https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?timeout=50", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ directUrls: [`https://www.instagram.com/reel/${p.ig_id}/`], resultsType: "posts", resultsLimit: 1, addParentData: false }),
    cache: "no-store",
  });
  const items = (await res.json().catch(() => [])) as { videoUrl?: string; audioUrl?: string; videoPlayCount?: number; likesCount?: number; commentsCount?: number }[];
  const nuevo = Array.isArray(items) ? items[0] : undefined;
  if (!nuevo?.videoUrl) throw new Error("Instagram no devolvió el video (puede haberse borrado)");
  await db()
    .from("publicaciones")
    .update({
      media_url: nuevo.videoUrl,
      audio_url: nuevo.audioUrl ?? null,
      ...(typeof nuevo.videoPlayCount === "number" ? { vistas: nuevo.videoPlayCount } : {}),
      ...(typeof nuevo.likesCount === "number" && nuevo.likesCount >= 0 ? { likes: nuevo.likesCount } : {}),
      ...(typeof nuevo.commentsCount === "number" ? { comentarios: nuevo.commentsCount } : {}),
    })
    .eq("id", id);
  return { video: nuevo.videoUrl, audio: videoSinAudio(nuevo.videoUrl) ? (nuevo.audioUrl ?? null) : null };
}

export async function urlVideoReel(id: string): Promise<string> {
  return (await linksReel(id)).video;
}
