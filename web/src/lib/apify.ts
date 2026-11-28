import "server-only";
import { db } from "./supabase";
import { copiarImagen, copiarVideo, esPropia } from "./almacen";
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

export type OpcionesSync = {
  referenteIds?: string[]; // vacío = todas las cuentas (según sus interruptores)
  feed: boolean; // reels y carruseles
  historias: boolean;
  dias: number; // cuánto hacia atrás en el feed (0 = sin límite)
  maximo: number; // tope de publicaciones por cuenta
};

export const SYNC_DIARIA_DEFECTO: Omit<OpcionesSync, "referenteIds"> = { feed: true, historias: true, dias: 7, maximo: 8 };
export const SYNC_PRIMERA_VEZ: Omit<OpcionesSync, "referenteIds"> = { feed: true, historias: true, dias: 30, maximo: 30 };

export async function leerSyncDiaria(): Promise<Omit<OpcionesSync, "referenteIds">> {
  const { data } = await db().from("ajustes").select("valor").eq("clave", "sync_diaria").maybeSingle();
  return { ...SYNC_DIARIA_DEFECTO, ...((data?.valor as object) ?? {}) };
}

export async function guardarSyncDiaria(o: Omit<OpcionesSync, "referenteIds">) {
  const { error } = await db().from("ajustes").upsert({ clave: "sync_diaria", valor: o, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function iniciarSincronizacion(o: OpcionesSync): Promise<string> {
  if (!o.feed && !o.historias) return "Elegí al menos feed o historias.";
  let q = db().from("referentes").select("id, ig_username, contenido_activo, historias_activo");
  if (o.referenteIds?.length) q = q.in("id", o.referenteIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const refs = (data ?? []) as { ig_username: string; contenido_activo: boolean; historias_activo: boolean }[];
  if (!refs.length) return "No hay referentes para sincronizar.";

  // Con cuentas elegidas a mano, se respeta lo pedido aunque tengan el interruptor apagado.
  const una = Boolean(o.referenteIds?.length);
  const conFeed = o.feed ? refs.filter((r) => una || r.contenido_activo) : [];
  const conHistorias = o.historias ? refs.filter((r) => una || r.historias_activo) : [];
  const url = (u: string) => `https://www.instagram.com/${u}/`;
  const maximo = Math.min(Math.max(Math.round(o.maximo) || 8, 1), 200);

  const tareas: Promise<unknown>[] = [];
  if (conFeed.length) {
    tareas.push(arrancar(ACTOR_POSTS, { directUrls: conFeed.map((r) => url(r.ig_username)), resultsType: "details", resultsLimit: 1 }, "detalles"));
    tareas.push(
      arrancar(
        ACTOR_POSTS,
        {
          directUrls: conFeed.map((r) => url(r.ig_username)),
          resultsType: "posts",
          resultsLimit: maximo,
          addParentData: false,
          ...(o.dias > 0 ? { onlyPostsNewerThan: `${Math.round(o.dias)} days` } : {}),
        },
        "posts",
      ),
    );
  }
  if (conHistorias.length) {
    tareas.push(arrancar(ACTOR_HISTORIAS, { usernames: conHistorias.map((r) => r.ig_username), includeStories: true, includeHighlights: false }, "historias"));
  }
  if (!tareas.length) return "Ninguna cuenta tiene activado lo que elegiste.";
  await Promise.all(tareas);

  const partes = [
    conFeed.length && `feed de ${conFeed.length} ${conFeed.length === 1 ? "cuenta" : "cuentas"} (${o.dias > 0 ? `últimos ${o.dias} días, ` : ""}hasta ${maximo} c/u)`,
    conHistorias.length && `historias de ${conHistorias.length} ${conHistorias.length === 1 ? "cuenta" : "cuentas"}`,
  ].filter(Boolean);
  return `Sincronizando ${partes.join(" y ")}. Tarda entre 1 y 5 minutos.`;
}

// Las publicaciones importadas desde Sort Feed llegan sin portada ni texto.
// Esto los completa con Apify, solo para los ganadores (2x o más), que es lo que vale la pena mirar.
export async function pendientesDePortada(): Promise<{ id: string; url: string }[]> {
  const { data, error } = await db()
    .from("publicaciones_con_score")
    .select("id, url, ig_id, tipo")
    .is("miniatura_url", null)
    .eq("es_ganador", true)
    .order("outlier", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; url: string | null; ig_id: string; tipo: string }[]).map((p) => ({
    id: p.id,
    url: p.url ?? `https://www.instagram.com/${p.tipo === "reel" ? "reel" : "p"}/${p.ig_id}/`,
  }));
}

export async function completarPortadas(maximo = 40): Promise<string> {
  const pendientes = (await pendientesDePortada()).slice(0, maximo);
  if (!pendientes.length) return "No hay ganadores sin portada.";
  await arrancar(ACTOR_POSTS, { directUrls: pendientes.map((p) => p.url), resultsType: "posts", resultsLimit: 1, addParentData: false }, "posts");
  return `Completando portada y texto de ${pendientes.length} ganadores (~US$ ${(pendientes.length * 0.0027).toFixed(2)}). Tarda unos minutos.`;
}

export async function itemsDelDataset(datasetId: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json`, {
    headers: { Authorization: `Bearer ${tokenApify()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`No se pudo leer el dataset (${res.status})`);
  return res.json();
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
    const miniatura = esPropia(yaGuardadas.get(codigo)) ? yaGuardadas.get(codigo) : await copiarImagen(it.displayUrl as string, `publicaciones/${codigo}.jpg`);
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

  // Ya guardadas con su imagen en nuestro almacenamiento: no se vuelven a procesar.
  const { data: existentes } = await db()
    .from("historias")
    .select("ig_id, miniatura_url")
    .in("ig_id", filas.map((f) => String((f.s as Record<string, unknown>).id)));
  const ya = new Set(
    ((existentes ?? []) as { ig_id: string; miniatura_url: string | null }[]).filter((e) => esPropia(e.miniatura_url)).map((e) => e.ig_id),
  );
  const nuevas = filas.filter((f) => !ya.has(String((f.s as Record<string, unknown>).id)));

  const aGuardar: Record<string, unknown>[] = [];
  await enLotes(nuevas, 6, async ({ referenteId, s }) => {
    const h = s as Record<string, unknown>;
    const id = String(h.id);
    const imagen = await copiarImagen(h.imageUrl as string, `historias/${id}.jpg`);
    // Los videos de historias también se guardan completos (en Instagram el link vence a los pocos días).
    const video = h.mediaType === "video" ? await copiarVideo(h.videoUrl as string, `historias/${id}.mp4`) : null;
    aGuardar.push({
      referente_id: referenteId,
      ig_id: id,
      fecha_publicacion: new Date(Number(h.takenAt) * 1000).toISOString(),
      tipo_media: h.mediaType === "video" ? "video" : "imagen",
      miniatura_url: imagen ?? (h.imageUrl as string) ?? null,
      media_url: video ?? (h.videoUrl as string) ?? imagen ?? null,
      duracion_seg: typeof h.videoDuration === "number" ? Math.round(h.videoDuration) : null,
    });
  });
  if (aGuardar.length) {
    const { error } = await db().from("historias").upsert(aGuardar, { onConflict: "ig_id" });
    if (error) throw new Error(error.message);
  }
  return aGuardar.length;
}

// ---------- Transcripción de un reel (se cobra por reel, solo cuando la pedís) ----------

export const ACTOR_TRANSCRIPCION = "steadyfetch~instagram-reel-transcript-scraper";

export async function transcribirPublicacion(id: string) {
  const { data: p, error } = await db().from("publicaciones").select("id, ig_id, tipo, analisis").eq("id", id).single();
  if (error || !p) throw new Error("No encontré esa publicación");
  if (p.tipo !== "reel") throw new Error("Solo se pueden transcribir reels");

  const items = (await apify(`/acts/${ACTOR_TRANSCRIPCION}/run-sync-get-dataset-items?timeout=150`, {
    method: "POST",
    body: JSON.stringify({ reelUrls: [`https://www.instagram.com/reel/${p.ig_id}/`], includeOnScreenText: true }),
  })) as Record<string, unknown>[];

  const it = items.find((x) => x.status === "transcribed");
  if (!it) {
    const motivo = items.find((x) => !x._summary)?.statusReason;
    throw new Error(motivo ? `No se pudo transcribir: ${motivo}` : "No se pudo transcribir este reel");
  }
  const texto = ((it.transcript as string) || (it.onScreenText as string) || "").trim();
  const { error: e2 } = await db()
    .from("publicaciones")
    .update({
      transcripcion: texto || "(El reel no tiene voz ni texto para transcribir)",
      hook: (it.hook3s as string) || null,
      analisis: {
        ...((p.analisis as object) ?? {}),
        transcripcion: {
          idioma: (it.language as string) ?? null,
          segmentos: ((it.segments as { start: number; end: number; text: string }[]) ?? []).map((s) => ({
            start: Math.round(s.start * 10) / 10,
            end: Math.round(s.end * 10) / 10,
            text: s.text.trim(),
          })),
          texto_en_pantalla: (it.onScreenText as string) ?? null,
        },
      },
    })
    .eq("id", id);
  if (e2) throw new Error(e2.message);
}
