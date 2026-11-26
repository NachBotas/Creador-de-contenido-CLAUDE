import "server-only";
import { db } from "./supabase";
import type { Formato, Historia, Publicacion, Referente } from "./tipos";
import { diaClave } from "./formato";

export type Filtros = {
  tipo: "todos" | "reel" | "carrusel";
  formato: string; // "" = todos, "sin" = sin clasificar, o id
  referente: string;
  orden: string;
  min: number; // outlier mínimo
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
  return {
    tipo,
    formato: uno(sp.formato),
    referente: uno(sp.referente),
    orden: uno(sp.orden) || "outlier",
    min: Number.isFinite(min) && min > 0 ? min : 0,
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
  if (f.min > 0) q = q.gte("outlier", f.min);
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

// Cuántas piezas hay por formato con los filtros actuales (para las pestañas).
export async function contarPorFormato(f: Filtros): Promise<Map<string, number>> {
  let q = db().from("publicaciones_con_score").select("formato_id");
  q = aplicarFiltros(q, f, false).limit(5000);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const conteo = new Map<string, number>();
  for (const fila of (data ?? []) as { formato_id: number | null }[]) {
    const k = fila.formato_id === null ? "sin" : String(fila.formato_id);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
    conteo.set("", (conteo.get("") ?? 0) + 1);
  }
  return conteo;
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

export async function listarSecuencias(dias: number, referente: string): Promise<Secuencia[]> {
  let q = db()
    .from("historias")
    .select("*")
    .gte("fecha_publicacion", new Date(Date.now() - dias * 86_400_000).toISOString())
    .order("fecha_publicacion", { ascending: true })
    .limit(3000);
  if (referente) q = q.eq("referente_id", referente);
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
