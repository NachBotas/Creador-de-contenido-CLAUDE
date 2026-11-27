import "server-only";
import { db } from "./supabase";
import { cifrar, descifrar } from "./cifrado";
import { urlPublica } from "./apify";

// Guarda las historias (video o imagen completa) en el Google Drive del usuario.
// Permiso mínimo (drive.file): la app solo ve los archivos y carpetas que ella misma crea.

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CARPETA_RAIZ = "Radar – Historias";
const API = "https://www.googleapis.com/drive/v3";
const SUBIDA = "https://www.googleapis.com/upload/drive/v3";

type Ajuste = { refresh_cifrado: string; carpeta_id: string; email: string | null };

export function driveConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redireccion(): string {
  const base = urlPublica();
  if (!base) throw new Error("Falta APP_URL");
  return `${base}/api/google/callback`;
}

export function urlAutorizacionDrive(state: string): string {
  if (!driveConfigurado()) throw new Error("Falta configurar Google (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET)");
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redireccion(),
    response_type: "code",
    scope: `${SCOPE} openid email`,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function leerAjuste(): Promise<Ajuste | null> {
  const { data } = await db().from("ajustes").select("valor").eq("clave", "google_drive").maybeSingle();
  return (data?.valor as Ajuste) ?? null;
}

export async function estadoDrive(): Promise<{ conectado: boolean; email: string | null; carpetaUrl: string | null }> {
  const a = await leerAjuste();
  return a
    ? { conectado: true, email: a.email, carpetaUrl: `https://drive.google.com/drive/folders/${a.carpeta_id}` }
    : { conectado: false, email: null, carpetaUrl: null };
}

export async function desconectarDrive() {
  await db().from("ajustes").delete().eq("clave", "google_drive");
}

let tokenEnCache: { valor: string; vence: number } | null = null;

async function tokenAcceso(): Promise<string> {
  if (tokenEnCache && tokenEnCache.vence > Date.now() + 60_000) return tokenEnCache.valor;
  const a = await leerAjuste();
  if (!a) throw new Error("Google Drive no está conectado");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: await descifrar(a.refresh_cifrado),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!json.access_token) throw new Error(`Google rechazó el acceso: ${json.error_description ?? json.error ?? res.status}. Volvé a conectar Drive.`);
  tokenEnCache = { valor: json.access_token, vence: Date.now() + (json.expires_in ?? 3000) * 1000 };
  return json.access_token;
}

async function api<T>(url: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token ?? (await tokenAcceso())}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Drive respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? {} : await res.json()) as T;
}

async function crearCarpeta(nombre: string, padre: string | null, token?: string): Promise<string> {
  const r = await api<{ id: string }>(
    `${API}/files?fields=id`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nombre, mimeType: "application/vnd.google-apps.folder", ...(padre ? { parents: [padre] } : {}) }),
    },
    token,
  );
  return r.id;
}

export async function conectarDriveConCodigo(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redireccion(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; id_token?: string; error_description?: string };
  if (!json.access_token || !json.refresh_token) throw new Error(json.error_description ?? "Google no devolvió el permiso completo. Probá de nuevo.");
  let email: string | null = null;
  try {
    email = JSON.parse(Buffer.from(json.id_token!.split(".")[1], "base64url").toString()).email ?? null;
  } catch {
    /* sin email, no pasa nada */
  }
  const anterior = await leerAjuste();
  let carpeta = anterior?.carpeta_id ?? null;
  if (carpeta) {
    // Si la carpeta sigue existiendo (aunque la hayan movido), la reusamos.
    const ok = await fetch(`${API}/files/${carpeta}?fields=id,trashed`, { headers: { Authorization: `Bearer ${json.access_token}` } })
      .then(async (r) => r.ok && !((await r.json()) as { trashed?: boolean }).trashed)
      .catch(() => false);
    if (!ok) carpeta = null;
  }
  if (!carpeta) carpeta = await crearCarpeta(CARPETA_RAIZ, null, json.access_token);
  const valor: Ajuste = { refresh_cifrado: await cifrar(json.refresh_token), carpeta_id: carpeta, email };
  const { error } = await db().from("ajustes").upsert({ clave: "google_drive", valor, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  tokenEnCache = null;
  carpetas.clear();
}

// Carpetas "Radar – Historias / @cuenta / AAAA-MM-DD", buscadas o creadas una sola vez por ejecución.
const carpetas = new Map<string, string>();

async function carpetaHija(nombre: string, padre: string): Promise<string> {
  const clave = `${padre}/${nombre}`;
  const enCache = carpetas.get(clave);
  if (enCache) return enCache;
  const q = `name = '${nombre.replace(/'/g, "\\'")}' and '${padre}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const r = await api<{ files: { id: string }[] }>(`${API}/files?${new URLSearchParams({ q, fields: "files(id)", pageSize: "1" })}`);
  const id = r.files[0]?.id ?? (await crearCarpeta(nombre, padre));
  carpetas.set(clave, id);
  return id;
}

async function subirArchivo(nombre: string, tipo: string, bytes: Uint8Array, padre: string): Promise<string> {
  const token = await tokenAcceso();
  const inicio = await fetch(`${SUBIDA}/files?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Upload-Content-Type": tipo, "X-Upload-Content-Length": String(bytes.length) },
    body: JSON.stringify({ name: nombre, parents: [padre] }),
    cache: "no-store",
  });
  const destino = inicio.headers.get("location");
  if (!inicio.ok || !destino) throw new Error(`Drive no aceptó la subida (${inicio.status})`);
  const res = await fetch(destino, { method: "PUT", headers: { "Content-Type": tipo }, body: new Blob([bytes as BlobPart], { type: tipo }), cache: "no-store" });
  if (!res.ok) throw new Error(`Falló la subida a Drive (${res.status})`);
  const { id } = (await res.json()) as { id: string };
  // Cualquiera con el link puede verlo: así se reproduce dentro de la app sin pedir sesión de Google.
  await api(`${API}/files/${id}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "reader", type: "anyone" }) }).catch(() => undefined);
  return id;
}

type Pendiente = {
  id: string;
  ig_id: string;
  fecha_publicacion: string;
  tipo_media: string | null;
  media_url: string | null;
  miniatura_url: string | null;
  referentes: { ig_username: string } | null;
};

// Sube a Drive las historias que todavía no están. Corre después de cada captura y en el cron diario.
export async function subirHistoriasPendientes(limiteMs = 200_000): Promise<string> {
  const ajuste = await leerAjuste();
  if (!driveConfigurado() || !ajuste) return "Drive no conectado";
  const empezo = Date.now();
  const { data, error } = await db()
    .from("historias")
    .select("id, ig_id, fecha_publicacion, tipo_media, media_url, miniatura_url, referentes(ig_username)")
    .is("drive_estado", null)
    .order("created_at", { ascending: true })
    .limit(150);
  if (error) throw new Error(error.message);
  const lista = (data ?? []) as unknown as Pendiente[];
  let subidas = 0;
  for (const h of lista) {
    if (Date.now() - empezo > limiteMs) break;
    const esVideo = h.tipo_media === "video" && h.media_url && h.media_url !== h.miniatura_url;
    const origen = esVideo ? h.media_url : h.miniatura_url;
    try {
      const res = origen ? await fetch(origen, { cache: "no-store" }) : null;
      if (!res || !res.ok) {
        await db().from("historias").update({ drive_estado: "no-disponible" }).eq("id", h.id);
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const fecha = new Date(h.fecha_publicacion);
      const dia = fecha.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
      const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).replace(":", "");
      const cuenta = await carpetaHija(`@${h.referentes?.ig_username ?? "sin-cuenta"}`, ajuste.carpeta_id);
      const carpetaDia = await carpetaHija(dia, cuenta);
      const id = await subirArchivo(`${dia}_${hora}_${h.ig_id}.${esVideo ? "mp4" : "jpg"}`, esVideo ? "video/mp4" : "image/jpeg", bytes, carpetaDia);
      await db().from("historias").update({ drive_archivo_id: id, drive_estado: "ok" }).eq("id", h.id);
      subidas++;
    } catch (e) {
      // Si Drive falla (por ejemplo, sin espacio), se reintenta en la próxima pasada.
      if (/storageQuota|quota/i.test((e as Error).message)) return `Drive sin espacio: se subieron ${subidas}. Liberá espacio y se retoma solo.`;
    }
  }
  return `Subidas a Drive: ${subidas} de ${lista.length} pendientes.`;
}
