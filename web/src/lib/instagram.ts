import "server-only";
import { db } from "./supabase";
import { cifrar, descifrar } from "./cifrado";
import { urlPublica } from "./apify";
import { copiarImagen } from "./almacen";

// API oficial de Instagram con "Instagram Login" (cuentas profesionales: Empresa o Creador).
// No se guardan contraseñas: cada cuenta autoriza desde la página de Instagram.

const GRAPH = "https://graph.instagram.com";
export const PERMISOS = ["instagram_business_basic", "instagram_business_manage_insights"];

function credencialesApp() {
  const id = process.env.INSTAGRAM_APP_ID;
  const secreto = process.env.INSTAGRAM_APP_SECRET;
  if (!id || !secreto) throw new Error("Falta configurar la app de Instagram (INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET)");
  return { id, secreto };
}

export function instagramConfigurado(): boolean {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}

export function urlRedireccion(): string {
  const base = urlPublica();
  if (!base) throw new Error("Falta APP_URL");
  return `${base}/api/instagram/callback`;
}

export function urlAutorizacion(state: string): string {
  const { id } = credencialesApp();
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: urlRedireccion(),
    response_type: "code",
    scope: PERMISOS.join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p}`;
}

type ErrorGraph = { error?: { message?: string; code?: number } };

async function graph<T>(ruta: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const p = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}${ruta}?${p}`, { cache: "no-store" });
  const json = (await res.json()) as T & ErrorGraph;
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Instagram respondió ${res.status}`);
  return json;
}

// ---------- Conexión ----------

export async function conectarConCodigo(code: string): Promise<string> {
  const { id, secreto } = credencialesApp();
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({ client_id: id, client_secret: secreto, grant_type: "authorization_code", redirect_uri: urlRedireccion(), code }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; data?: { access_token: string }[] } & ErrorGraph & { error_message?: string };
  const corto = json.access_token ?? json.data?.[0]?.access_token;
  if (!corto) throw new Error(json.error_message ?? json.error?.message ?? "Instagram no devolvió el acceso");

  // Token de 60 días
  const largo = await graph<{ access_token: string; expires_in: number }>("/access_token", corto, {
    grant_type: "ig_exchange_token",
    client_secret: secreto,
  });
  const perfil = await leerPerfil(largo.access_token);
  const { data, error } = await db()
    .from("cuentas_ig")
    .upsert(
      {
        ig_user_id: perfil.user_id,
        username: perfil.username,
        nombre: perfil.name ?? null,
        seguidores: perfil.followers_count ?? null,
        seguidos: perfil.follows_count ?? null,
        cantidad_posts: perfil.media_count ?? null,
        token_cifrado: await cifrar(largo.access_token),
        token_expira: new Date(Date.now() + largo.expires_in * 1000).toISOString(),
        ultimo_error: null,
      },
      { onConflict: "ig_user_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const cuentaId = (data as { id: string }).id;
  await sincronizarCuenta(cuentaId).catch(() => undefined);
  return cuentaId;
}

type Perfil = {
  user_id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

async function leerPerfil(token: string): Promise<Perfil> {
  return graph<Perfil>("/me", token, { fields: "user_id,username,name,profile_picture_url,followers_count,follows_count,media_count" });
}

// ---------- Sincronización ----------

type Insight = { name: string; values?: { value: number; end_time: string }[]; total_value?: { value?: number; breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } };

export async function sincronizarCuenta(cuentaId: string): Promise<void> {
  const { data: c, error } = await db().from("cuentas_ig").select("*").eq("id", cuentaId).single();
  if (error || !c) throw new Error("No encontré esa cuenta");
  let token = await descifrar(c.token_cifrado as string);

  try {
    // Renovar el token si vence en menos de 20 días
    if (c.token_expira && new Date(c.token_expira as string).getTime() - Date.now() < 20 * 86_400_000) {
      const nuevo = await graph<{ access_token: string; expires_in: number }>("/refresh_access_token", token, { grant_type: "ig_refresh_token" });
      token = nuevo.access_token;
      await db()
        .from("cuentas_ig")
        .update({ token_cifrado: await cifrar(token), token_expira: new Date(Date.now() + nuevo.expires_in * 1000).toISOString() })
        .eq("id", cuentaId);
    }

    // Perfil y foto del total de seguidores de hoy
    const perfil = await leerPerfil(token);
    const foto = await copiarImagen(perfil.profile_picture_url, `cuentas/${perfil.username}.jpg`);
    await db()
      .from("cuentas_ig")
      .update({
        username: perfil.username,
        nombre: perfil.name ?? null,
        seguidores: perfil.followers_count ?? null,
        seguidos: perfil.follows_count ?? null,
        cantidad_posts: perfil.media_count ?? null,
        ...(foto ? { foto_url: `${foto}?v=${Date.now()}` } : {}),
      })
      .eq("id", cuentaId);
    const hoy = new Date().toISOString().slice(0, 10);
    await db().from("metricas_diarias").upsert({ cuenta_id: cuentaId, fecha: hoy, seguidores: perfil.followers_count ?? null }, { onConflict: "cuenta_id,fecha" });

    const errores: string[] = [];
    await Promise.all([
      diarias(cuentaId, token).catch((e) => errores.push(`Alcance: ${(e as Error).message}`)),
      demografia(cuentaId, token).catch((e) => errores.push(`Audiencia: ${(e as Error).message}`)),
      posts(cuentaId, token).catch((e) => errores.push(`Posts: ${(e as Error).message}`)),
    ]);
    await db()
      .from("cuentas_ig")
      .update({ ultima_sync: new Date().toISOString(), ultimo_error: errores.length ? errores.join(" · ").slice(0, 500) : null })
      .eq("id", cuentaId);
  } catch (e) {
    await db().from("cuentas_ig").update({ ultimo_error: (e as Error).message.slice(0, 500) }).eq("id", cuentaId);
    throw e;
  }
}

// Alcance y seguidores nuevos por día (Instagram da hasta 30 días hacia atrás).
async function diarias(cuentaId: string, token: string) {
  const hasta = Math.floor(Date.now() / 1000);
  const desde = hasta - 29 * 86_400;
  const filas = new Map<string, { cuenta_id: string; fecha: string; alcance?: number; nuevos_seguidores?: number }>();
  const leer = async (metric: string, campo: "alcance" | "nuevos_seguidores") => {
    const r = await graph<{ data: Insight[] }>("/me/insights", token, { metric, period: "day", since: String(desde), until: String(hasta) });
    for (const v of r.data?.[0]?.values ?? []) {
      const fecha = v.end_time.slice(0, 10);
      const f = filas.get(fecha) ?? { cuenta_id: cuentaId, fecha };
      f[campo] = v.value;
      filas.set(fecha, f);
    }
  };
  await leer("reach", "alcance");
  // follower_count solo existe para cuentas con 100+ seguidores
  await leer("follower_count", "nuevos_seguidores").catch(() => undefined);
  if (filas.size) {
    const { error } = await db().from("metricas_diarias").upsert([...filas.values()], { onConflict: "cuenta_id,fecha" });
    if (error) throw new Error(error.message);
  }
}

const DIMENSIONES = { gender: "genero", age: "edad", country: "pais", city: "ciudad" } as const;

async function demografia(cuentaId: string, token: string) {
  const filas: { cuenta_id: string; dimension: string; clave: string; valor: number; actualizado: string }[] = [];
  const ahora = new Date().toISOString();
  for (const [breakdown, dimension] of Object.entries(DIMENSIONES)) {
    const base = { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown };
    let r: { data: Insight[] };
    try {
      r = await graph<{ data: Insight[] }>("/me/insights", token, base);
    } catch {
      r = await graph<{ data: Insight[] }>("/me/insights", token, { ...base, timeframe: "this_month" });
    }
    for (const x of r.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []) {
      filas.push({ cuenta_id: cuentaId, dimension, clave: x.dimension_values.join(" "), valor: x.value, actualizado: ahora });
    }
  }
  if (!filas.length) return;
  await db().from("demografia").delete().eq("cuenta_id", cuentaId);
  const { error } = await db().from("demografia").insert(filas);
  if (error) throw new Error(error.message);
}

type Media = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
};

async function posts(cuentaId: string, token: string) {
  const r = await graph<{ data: Media[] }>("/me/media", token, {
    fields: "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count",
    limit: "30",
  });
  const lista = r.data ?? [];
  const filas = await Promise.all(
    lista.map(async (m) => {
      const ins = await insightsMedia(m.id, token);
      const imagen = await copiarImagen(m.thumbnail_url ?? (m.media_type === "VIDEO" ? undefined : m.media_url), `propios/${m.id}.jpg`);
      return {
        cuenta_id: cuentaId,
        ig_media_id: m.id,
        tipo: m.media_product_type === "REELS" ? "REELS" : m.media_type ?? null,
        permalink: m.permalink ?? null,
        caption: m.caption ?? null,
        fecha: m.timestamp ?? null,
        miniatura_url: imagen ?? m.thumbnail_url ?? m.media_url ?? null,
        likes: m.like_count ?? null,
        comentarios: m.comments_count ?? null,
        alcance: ins.reach ?? null,
        vistas: ins.views ?? null,
        guardados: ins.saved ?? null,
        compartidos: ins.shares ?? null,
        interacciones: ins.total_interactions ?? null,
        updated_at: new Date().toISOString(),
      };
    }),
  );
  if (filas.length) {
    const { error } = await db().from("posts_propios").upsert(filas, { onConflict: "ig_media_id" });
    if (error) throw new Error(error.message);
  }
}

async function insightsMedia(id: string, token: string): Promise<Record<string, number>> {
  for (const metric of ["reach,saved,shares,views,total_interactions", "reach,saved,shares,total_interactions", "reach"]) {
    try {
      const r = await graph<{ data: Insight[] }>(`/${id}/insights`, token, { metric });
      return Object.fromEntries((r.data ?? []).map((d) => [d.name, d.values?.[0]?.value ?? d.total_value?.value ?? 0]));
    } catch {
      /* probamos con menos métricas */
    }
  }
  return {};
}

export async function sincronizarTodasLasCuentas(): Promise<number> {
  const { data } = await db().from("cuentas_ig").select("id");
  let ok = 0;
  for (const c of (data ?? []) as { id: string }[]) {
    try {
      await sincronizarCuenta(c.id);
      ok++;
    } catch {
      /* el error queda guardado en la cuenta */
    }
  }
  return ok;
}
