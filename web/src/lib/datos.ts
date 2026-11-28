import "server-only";
import { db } from "./supabase";
import type { Formato, Historia, Publicacion, Referente } from "./tipos";
import { diaClave } from "./formato";

export type Filtros = {
  tipo: "todos" | "reel" | "carrusel";
  formato: string; // "" = todos, "sin" = sin clasificar, o id
  referente: string;
  carpeta: string; // "" = todas
  referentesCarpeta: string[] | null; // ids de los referentes de la carpeta (se completa aparte)
  orden: string;
  min: number; // outlier mínimo
  minCom: number; // comentarios mínimos
  dias: number; // 0 = siempre
  ganadores: boolean;
  cta: boolean; // solo los que piden comentar una palabra
  q: string;
  vista: "grilla" | "tablero";
};

type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function leerFiltros(sp: SP, tipo: Filtros["tipo"]): Filtros {
  const min = Number(uno(sp.min));
  const dias = uno(sp.dias);
  const t = uno(sp.t);
  return {
    tipo: tipo === "todos" && (t === "reel" || t === "carrusel") ? t : tipo,
    formato: uno(sp.formato),
    referente: uno(sp.referente),
    carpeta: uno(sp.carpeta),
    referentesCarpeta: null,
    orden: uno(sp.orden) || "outlier",
    min: Number.isFinite(min) && min > 0 ? min : 0,
    minCom: Math.max(0, Number(uno(sp.mincom)) || 0),
    dias: dias === "" ? 90 : Number(dias) || 0,
    ganadores: uno(sp.ganadores) === "1",
    cta: uno(sp.cta) === "1",
    q: uno(sp.q).trim().slice(0, 80),
    vista: uno(sp.vista) === "tablero" ? "tablero" : "grilla",
  };
}

const COLUMNA_ORDEN: Record<string, string> = {
  outlier: "outlier",
  recientes: "fecha_publicacion",
  comentarios: "comentarios",
  tasa: "tasa_comentarios",
  outlier_com: "outlier_comentarios",
  vistas: "metrica",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(q: any, f: Filtros, conFormato: boolean) {
  if (f.tipo === "reel") q = q.eq("tipo", "reel");
  if (f.tipo === "carrusel") q = q.in("tipo", ["carrusel", "imagen"]);
  if (conFormato && f.formato === "sin") q = q.is("formato_id", null);
  else if (conFormato && f.formato) q = q.eq("formato_id", Number(f.formato));
  if (f.referente) q = q.eq("referente_id", f.referente);
  else if (f.referentesCarpeta) q = q.in("referente_id", f.referentesCarpeta.length ? f.referentesCarpeta : ["00000000-0000-0000-0000-000000000000"]);
  if (f.min > 0) q = q.gte("outlier", f.min);
  if (f.minCom > 0) q = q.gte("comentarios", f.minCom);
  if (f.dias > 0) q = q.gte("fecha_publicacion", new Date(Date.now() - f.dias * 86_400_000).toISOString());
  if (f.ganadores) q = q.eq("es_ganador", true);
  if (f.cta) q = q.not("palabra_clave", "is", null);
  if (f.q) q = q.ilike("caption", `%${f.q.replace(/[%_,()]/g, " ")}%`);
  return q;
}

export async function listarPublicaciones(f: Filtros, limite = 120): Promise<Publicacion[]> {
  let q = db().from("publicaciones_con_score").select("*");
  q = aplicarFiltros(q, f, true);
  q = q
    .order(COLUMNA_ORDEN[f.orden] ?? "outlier", { ascending: false, nullsFirst: false })
    .order("fecha_publicacion", { ascending: false })
    .limit(limite);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Publicacion[];
}

// Cuántas piezas hay por formato y por tipo con los filtros actuales (para las pestañas).
export type RankingFormato = { clave: string; piezas: number; ganadores: number; outlierMediano: number | null; comentariosPromedio: number };

// Conteos para pestañas y ranking, calculados en la base (una sola consulta liviana).
export async function contar(
  f: Filtros,
): Promise<{ porFormato: Map<string, number>; porTipo: Map<string, number>; ranking: RankingFormato[] }> {
  const referentes = f.referente ? [f.referente] : f.referentesCarpeta;
  const { data, error } = await db().rpc("conteos_publicaciones", {
    p_tipo: f.tipo,
    p_referentes: referentes && referentes.length ? referentes : referentes ? ["00000000-0000-0000-0000-000000000000"] : null,
    p_desde: f.dias > 0 ? new Date(Date.now() - f.dias * 86_400_000).toISOString() : null,
    p_min: f.min > 0 ? f.min : null,
    p_mincom: f.minCom > 0 ? f.minCom : null,
    p_ganadores: f.ganadores,
    p_cta: f.cta,
    p_q: f.q ? f.q.replace(/[%_]/g, " ") : null,
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as {
    porTipo?: Record<string, number>;
    todos?: number;
    porFormato?: Record<string, number>;
    totalTipo?: number;
    ranking?: { clave: string; piezas: number; ganadores: number; outlier_mediano: number | null; comentarios_promedio: number }[];
  };
  const porTipo = new Map<string, number>(Object.entries(r.porTipo ?? {}));
  porTipo.set("todos", r.todos ?? 0);
  const porFormato = new Map<string, number>(Object.entries(r.porFormato ?? {}));
  porFormato.set("", r.totalTipo ?? 0);
  const ranking = (r.ranking ?? []).map((x) => ({
    clave: x.clave,
    piezas: x.piezas,
    ganadores: x.ganadores,
    outlierMediano: x.outlier_mediano === null ? null : Number(x.outlier_mediano),
    comentariosPromedio: Number(x.comentarios_promedio) || 0,
  }));
  return { porFormato, porTipo, ranking };
}

export type Carpeta = { id: string; nombre: string; orden: number };

export async function listarCarpetas(): Promise<Carpeta[]> {
  const { data } = await db().from("carpetas").select("id, nombre, orden").order("orden").order("nombre");
  return (data ?? []) as Carpeta[];
}

export async function obtenerPublicacion(id: string): Promise<Publicacion | null> {
  const { data, error } = await db().from("publicaciones_con_score").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Publicacion | null;
}

export async function comentariosDe(publicacionId: string) {
  const { data, error } = await db()
    .from("comentarios")
    .select("id, usuario, texto, likes, fecha")
    .eq("publicacion_id", publicacionId)
    .order("likes", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; usuario: string | null; texto: string | null; likes: number | null; fecha: string | null }[];
}

export async function listarFormatos(): Promise<Formato[]> {
  const { data, error } = await db().from("formatos").select("*").order("orden").order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Formato[];
}

export async function listarReferentes(): Promise<Referente[]> {
  const { data, error } = await db().from("referentes").select("*").order("seguidores", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Referente[];
}

export async function conteosPorReferente(): Promise<Map<string, { publicaciones: number; historias: number }>> {
  const [pubs, hist] = await Promise.all([
    db().from("publicaciones").select("referente_id").limit(20000),
    db().from("historias").select("referente_id").limit(20000),
  ]);
  const m = new Map<string, { publicaciones: number; historias: number }>();
  const sumar = (id: string, k: "publicaciones" | "historias") => {
    const v = m.get(id) ?? { publicaciones: 0, historias: 0 };
    v[k]++;
    m.set(id, v);
  };
  for (const r of (pubs.data ?? []) as { referente_id: string }[]) sumar(r.referente_id, "publicaciones");
  for (const r of (hist.data ?? []) as { referente_id: string }[]) sumar(r.referente_id, "historias");
  return m;
}

export type Secuencia = { referenteId: string; dia: string; historias: Historia[]; activa: boolean };

export async function listarSecuencias(dias: number, referente: string, ids: string[] | null = null): Promise<Secuencia[]> {
  let q = db()
    .from("historias")
    .select("*")
    .gte("fecha_publicacion", new Date(Date.now() - dias * 86_400_000).toISOString())
    .order("fecha_publicacion", { ascending: true })
    .limit(3000);
  if (referente) q = q.eq("referente_id", referente);
  else if (ids) q = q.in("referente_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const grupos = new Map<string, Secuencia>();
  for (const h of (data ?? []) as Historia[]) {
    const dia = diaClave(h.fecha_publicacion);
    const k = `${h.referente_id}|${dia}`;
    const s = grupos.get(k) ?? { referenteId: h.referente_id, dia, historias: [], activa: false };
    s.historias.push(h);
    if (Date.now() - new Date(h.fecha_publicacion).getTime() < 86_400_000) s.activa = true;
    grupos.set(k, s);
  }
  return [...grupos.values()].sort((a, b) => (a.dia === b.dia ? b.historias.length - a.historias.length : a.dia < b.dia ? 1 : -1));
}

export async function obtenerSecuencia(referenteId: string, dia: string): Promise<Historia[]> {
  const desde = new Date(`${dia}T00:00:00-03:00`);
  const hasta = new Date(desde.getTime() + 86_400_000);
  const { data, error } = await db()
    .from("historias")
    .select("*")
    .eq("referente_id", referenteId)
    .gte("fecha_publicacion", desde.toISOString())
    .lt("fecha_publicacion", hasta.toISOString())
    .order("fecha_publicacion", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Historia[];
}

// ---------- Banco de ideas ----------

export async function idsGuardados(): Promise<Set<string>> {
  const { data } = await db().from("ideas").select("publicacion_id").limit(5000);
  return new Set(((data ?? []) as { publicacion_id: string }[]).map((r) => r.publicacion_id));
}

export async function carpetasDeIdeas(): Promise<Map<string, string | null>> {
  const { data } = await db().from("ideas").select("publicacion_id, carpeta_id").limit(5000);
  return new Map(((data ?? []) as { publicacion_id: string; carpeta_id: string | null }[]).map((i) => [i.publicacion_id, i.carpeta_id]));
}

export async function listarIdeas(carpeta = ""): Promise<Publicacion[]> {
  let q = db().from("ideas").select("publicacion_id, created_at").order("created_at", { ascending: false }).limit(500);
  if (carpeta === "sin") q = q.is("carpeta_id", null);
  else if (carpeta) q = q.eq("carpeta_id", carpeta);
  const { data: ideas, error } = await q;
  if (error) throw new Error(error.message);
  const ids = ((ideas ?? []) as { publicacion_id: string }[]).map((i) => i.publicacion_id);
  if (!ids.length) return [];
  const { data, error: e2 } = await db().from("publicaciones_con_score").select("*").in("id", ids);
  if (e2) throw new Error(e2.message);
  const porId = new Map(((data ?? []) as Publicacion[]).map((p) => [p.id, p]));
  return ids.map((id) => porId.get(id)).filter((p): p is Publicacion => Boolean(p));
}

export async function contarHistorias(dias: number, referente: string, ids: string[] | null = null): Promise<number> {
  let q = db().from("historias").select("id", { count: "exact", head: true });
  if (dias > 0) q = q.gte("fecha_publicacion", new Date(Date.now() - dias * 86_400_000).toISOString());
  if (referente) q = q.eq("referente_id", referente);
  else if (ids) q = q.in("referente_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { count } = await q;
  return count ?? 0;
}

// Cuántas publicaciones por día suele subir cada referente (últimos 30 días). Sirve para estimar costos.
export async function ritmoReferentes(): Promise<Map<string, number>> {
  const { data } = await db()
    .from("publicaciones")
    .select("referente_id")
    .gte("fecha_publicacion", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .limit(10000);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { referente_id: string }[]) m.set(r.referente_id, (m.get(r.referente_id) ?? 0) + 1);
  for (const [k, v] of m) m.set(k, Math.round((v / 30) * 10) / 10);
  return m;
}
