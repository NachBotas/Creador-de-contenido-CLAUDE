import "server-only";
import { db, BUCKET } from "./supabase";
import { detectarCta, detectarPalabraClave } from "./cta";

// Scrapers de Apify que usamos (probados).
export const ACTOR_POSTS = "apify~instagram-scraper";
export const ACTOR_HISTORIAS = "goat255~instagram-stories-highlights-scraper";

export type TipoCorrida = "detalles" | "posts" | "historias";

function tokenApify(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("Falta APIFY_TOKEN en la configuración");
  return t;
}

export function urlPublica(): string | null {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

async function apify(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.apify.com/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${tokenApify()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apify respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Arranca una corrida en Apify. Cuando termina, Apify avisa a /api/apify/webhook y ahí guardamos los datos.
async function arrancar(actor: string, input: unknown, tipo: TipoCorrida) {
  const base = urlPublica();
  if (!base) throw new Error("La sincronización necesita la web publicada (falta APP_URL)");
  const webhook = [
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED"],
      requestUrl: `${base}/api/apify/webhook?tipo=${tipo}&token=${encodeURIComponent(process.env.CRON_SECRET ?? "")}`,
    },
  ];
  const webhooks = Buffer.from(JSON.stringify(webhook)).toString("base64");
  await apify(`/acts/${actor}/runs?webhooks=${encodeURIComponent(webhooks)}`, { method: "POST", body: JSON.stringify(input) });
}

export async function iniciarSincronizacion(soloReferenteId?: string): Promise<string> {
  let q = db().from("referentes").select("id, ig_username, contenido_activo, historias_activo");
  if (soloReferenteId) q = q.eq("id", soloReferenteId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const refs = (data ?? []) as { ig_username: string; contenido_activo: boolean; historias_activo: boolean }[];
  if (!refs.length) return "No hay referentes para sincronizar.";

  const conContenido = refs.filter((r) => r.contenido_activo).map((r) => `https://www.instagram.com/${r.ig_username}/`);
  const conHistorias = refs.filter((r) => r.historias_activo).map((r) => r.ig_username);
  const limite = Number(process.env.POSTS_POR_CUENTA) || 30;

  const tareas: Promise<unknown>[] = [
    arrancar(ACTOR_POSTS, { directUrls: refs.map((r) => `https://www.instagram.com/${r.ig_username}/`), resultsType: "details", resultsLimit: 1 }, "detalles"),
  ];
  if (conContenido.length)
    tareas.push(arrancar(ACTOR_POSTS, { directUrls: conContenido, resultsType: "posts", resultsLimit: limite, addParentData: false }, "posts"));
  if (conHistorias.length)
    tareas.push(arrancar(ACTOR_HISTORIAS, { usernames: conHistorias, includeStories: true, includeHighlights: false }, "historias"));
  await Promise.all(tareas);

  return `Sincronización en marcha para ${refs.length} ${refs.length === 1 ? "cuenta" : "cuentas"}. Tarda entre 1 y 5 minutos.`;
}

export async function itemsDelDataset(datasetId: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json`, {
    headers: { Authorization: `Bearer ${tokenApify()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`No se pudo leer el dataset (${res.status})`);
  return res.json();
}

// ---------- Guardado de imágenes en Supabase Storage (las URLs de Instagram vencen) ----------

async function copiarImagen(url: string | undefined | null, ruta: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "image/jpeg";
    const cuerpo = new Uint8Array(await res.arrayBuffer());
    const { error } = await db().storage.from(BUCKET).upload(ruta, cuerpo, { contentType: tipo, upsert: true });
    if (error) return null;
    return db().storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
  } catch {
    return null;
  }
}

async function enLotes<T>(items: T[], tamano: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += tamano) await Promise.all(items.slice(i, i + tamano).map(fn));
}

async function mapaReferentes(): Promise<Map<string, string>> {
  const { data } = await db().from("referentes").select("id, ig_username");
  return new Map(((data ?? []) as { id: string; ig_username: string }[]).map((r) => [r.ig_username.toLowerCase(), r.id]));
}

const n = (v: unknown) => (typeof v === "number" && v >= 0 ? Math.round(v) : null);

// ---------- Procesar resultados ----------

export async function procesarDetalles(items: Record<string, unknown>[]) {
  const refs = await mapaReferentes();
  await enLotes(items, 4, async (it) => {
    const usuario = String(it.username ?? "").toLowerCase();
    const id = refs.get(usuario);
    if (!id) return;
    const foto = await copiarImagen((it.profilePicUrlHD ?? it.profilePicUrl) as string, `avatares/${usuario}.jpg`);
    await db()
      .from("referentes")
      .update({
        ig_user_id: it.id ? String(it.id) : null,
        nombre: (it.fullName as string) || null,
        seguidores: n(it.followersCount),
        ...(foto ? { foto_url: `${foto}?v=${Date.now()}` } : {}),
      })
      .eq("id", id);
  });
}

export async function procesarPosts(items: Record<string, unknown>[]) {
  const refs = await mapaReferentes();
  const validos = items.filter((it) => it.shortCode && refs.has(String(it.ownerUsername ?? "").toLowerCase()));
  if (!validos.length) return 0;

  // No volvemos a bajar miniaturas que ya tenemos guardadas.
  const { data: existentes } = await db()
    .from("publicaciones")
    .select("ig_id, miniatura_url")
    .in("ig_id", validos.map((it) => String(it.shortCode)));
  const yaGuardadas = new Map(((existentes ?? []) as { ig_id: string; miniatura_url: string | null }[]).map((e) => [e.ig_id, e.miniatura_url]));

  const filas: Record<string, unknown>[] = [];
  await enLotes(validos, 6, async (it) => {
    const codigo = String(it.shortCode);
    const tipo = it.type === "Sidecar" ? "carrusel" : it.type === "Video" ? "reel" : "imagen";
    const caption = (it.caption as string) ?? null;
    const hijos = Array.isArray(it.childPosts) ? (it.childPosts as Record<string, unknown>[]) : [];
    const imagenes = hijos.length ? hijos.map((c) => c.displayUrl as string) : ((it.images as string[]) ?? []);
    const miniatura = yaGuardadas.get(codigo)?.includes("supabase") ? yaGuardadas.get(codigo) : await copiarImagen(it.displayUrl as string, `publicaciones/${codigo}.jpg`);
    filas.push({
      referente_id: refs.get(String(it.ownerUsername).toLowerCase()),
      ig_id: codigo,
      tipo,
      url: it.url ?? `https://www.instagram.com/p/${codigo}/`,
      caption,
      fecha_publicacion: it.timestamp ?? null,
      vistas: n(it.videoPlayCount) ?? n(it.videoViewCount),
      likes: n(it.likesCount),
      comentarios: n(it.commentsCount),
      duracion_seg: typeof it.videoDuration === "number" ? Math.round(it.videoDuration) : null,
      miniatura_url: miniatura ?? (it.displayUrl as string) ?? null,
      media_url: (it.videoUrl as string) ?? null,
      slides: tipo === "carrusel" ? imagenes.filter(Boolean).map((url) => ({ url })) : null,
      fijado: it.isPinned === true,
      palabra_clave: detectarPalabraClave(caption),
      cta_tipo: detectarCta(caption),
    });
  });

  const { data: guardadas, error } = await db().from("publicaciones").upsert(filas, { onConflict: "ig_id" }).select("id, ig_id");
  if (error) throw new Error(error.message);

  // Comentarios que vienen con cada post.
  const idPorCodigo = new Map(((guardadas ?? []) as { id: string; ig_id: string }[]).map((g) => [g.ig_id, g.id]));
  const comentarios = validos.flatMap((it) =>
    ((it.latestComments as Record<string, unknown>[]) ?? []).map((c) => ({
      publicacion_id: idPorCodigo.get(String(it.shortCode)),
      ig_id: String(c.id),
      usuario: (c.ownerUsername as string) ?? null,
      texto: (c.text as string) ?? null,
      likes: n(c.likesCount),
      fecha: (c.timestamp as string) ?? null,
    })),
  ).filter((c) => c.publicacion_id && c.ig_id);
  if (comentarios.length) await db().from("comentarios").upsert(comentarios, { onConflict: "ig_id" });

  const usuarios = [...new Set(validos.map((it) => refs.get(String(it.ownerUsername).toLowerCase())))];
  await db().from("referentes").update({ ultima_sync: new Date().toISOString() }).in("id", usuarios as string[]);
  return filas.length;
}

export async function procesarHistorias(items: Record<string, unknown>[]) {
  const refs = await mapaReferentes();
  const filas: Record<string, unknown>[] = [];
  for (const perfil of items) {
    const referenteId = refs.get(String(perfil.username ?? "").toLowerCase());
    if (!referenteId || !Array.isArray(perfil.stories)) continue;
    for (const s of perfil.stories as Record<string, unknown>[]) {
      filas.push({ referenteId, s });
    }
  }
  if (!filas.length) return 0;

  const { data: existentes } = await db().from("historias").select("ig_id").in("ig_id", filas.map((f) => String((f.s as Record<string, unknown>).id)));
  const ya = new Set(((existentes ?? []) as { ig_id: string }[]).map((e) => e.ig_id));
  const nuevas = filas.filter((f) => !ya.has(String((f.s as Record<string, unknown>).id)));

  const aGuardar: Record<string, unknown>[] = [];
  await enLotes(nuevas, 6, async ({ referenteId, s }) => {
    const h = s as Record<string, unknown>;
    const id = String(h.id);
    const imagen = await copiarImagen(h.imageUrl as string, `historias/${id}.jpg`);
    aGuardar.push({
      referente_id: referenteId,
      ig_id: id,
      fecha_publicacion: new Date(Number(h.takenAt) * 1000).toISOString(),
      tipo_media: h.mediaType === "video" ? "video" : "imagen",
      miniatura_url: imagen ?? (h.imageUrl as string) ?? null,
      media_url: (h.videoUrl as string) ?? imagen ?? null,
      duracion_seg: typeof h.videoDuration === "number" ? Math.round(h.videoDuration) : null,
    });
  });
  if (aGuardar.length) {
    const { error } = await db().from("historias").upsert(aGuardar, { onConflict: "ig_id" });
    if (error) throw new Error(error.message);
  }
  return aGuardar.length;
}
