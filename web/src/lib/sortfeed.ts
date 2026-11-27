import "server-only";
import ExcelJS from "exceljs";
import { db } from "./supabase";
import { detectarCta, detectarPalabraClave } from "./cta";

// Lee el archivo que exporta Sort Feed (CSV o Excel) y lo carga en la base.
// Columnas esperadas: Profile, Reel|Post, Create Date, Views, Outlier Score, Likes, Comments, Caption y,
// si se exportó con "Export + Transcripts", una columna con la transcripción.

type Fila = Record<string, string>;

function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim()));
}

async function leerFilas(archivo: File): Promise<Fila[]> {
  let tabla: string[][];
  if (/\.xlsx$/i.test(archivo.name)) {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(await archivo.arrayBuffer()) as unknown as ArrayBuffer);
    const hoja = libro.worksheets[0];
    tabla = [];
    hoja.eachRow((row) => {
      const valores = (row.values as unknown[]).slice(1).map((v) => {
        if (v && typeof v === "object") {
          const o = v as { text?: string; hyperlink?: string; result?: unknown; richText?: { text: string }[] };
          if (o.hyperlink) return o.hyperlink;
          if (o.richText) return o.richText.map((r) => r.text).join("");
          if (o.text) return o.text;
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          return String(o.result ?? "");
        }
        return v === undefined || v === null ? "" : String(v);
      });
      tabla.push(valores);
    });
  } else {
    tabla = parsearCsv((await archivo.text()).replace(/^﻿/, ""));
  }
  const iCab = tabla.findIndex((f) => f.some((c) => c.trim().toLowerCase() === "profile"));
  if (iCab === -1) throw new Error("No parece un export de Sort Feed: falta la columna «Profile».");
  const cab = tabla[iCab].map((c) => c.trim().toLowerCase());
  return tabla.slice(iCab + 1).map((f) => Object.fromEntries(cab.map((c, i) => [c, (f[i] ?? "").trim()])));
}

const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return v && Number.isFinite(n) && String(v).match(/\d/) ? n : null;
};

// Hook = las primeras frases de la transcripción (aprox. los primeros 10 segundos).
export function hookDeTranscripcion(t: string): string {
  const limpio = t.replace(/\s+/g, " ").trim();
  const frases = limpio.match(/[^.!?¿¡]*[.!?]+|[^.!?]+$/g) ?? [limpio];
  let hook = "";
  for (const f of frases) {
    if (hook && (hook + f).split(" ").length > 30) break;
    hook += f;
  }
  return hook.trim().slice(0, 300);
}

export async function importarSortFeed(archivo: File): Promise<string> {
  if (archivo.size > 15 * 1024 * 1024) throw new Error("El archivo es muy grande (máximo 15 MB).");
  const filas = await leerFilas(archivo);
  const colTrans = filas.length ? Object.keys(filas[0]).find((k) => k.includes("transcri")) : undefined;

  type Item = { usuario: string; codigo: string; tipo: string; url: string; fecha: string | null; vistas: number | null; likes: number | null; comentarios: number | null; caption: string | null; transcripcion: string | null };
  const items: Item[] = [];
  for (const f of filas) {
    const link = f["reel"] || f["post"] || f["link"] || f["url"] || "";
    const m = link.match(/instagram\.com\/(?:[A-Za-z0-9._]+\/)?(reel|p)\/([A-Za-z0-9_-]+)/);
    const usuario = (f["profile"] || "").replace(/^@/, "").toLowerCase();
    if (!m || !usuario) continue;
    const fecha = f["create date"] || f["date"] || "";
    items.push({
      usuario,
      codigo: m[2],
      tipo: m[1] === "reel" ? "reel" : "imagen",
      url: `https://www.instagram.com/${m[1]}/${m[2]}/`,
      fecha: /^\d{4}-\d{2}-\d{2}/.test(fecha) ? `${fecha.slice(0, 10)}T12:00:00Z` : null,
      vistas: num(f["views"]),
      likes: num(f["likes"]),
      comentarios: num(f["comments"]),
      caption: f["caption"] || f["captions"] || null,
      transcripcion: (colTrans && f[colTrans]) || null,
    });
  }
  if (!items.length) throw new Error("No encontré publicaciones de Instagram en el archivo.");

  // Referentes (se crean los que falten)
  const usuarios = [...new Set(items.map((i) => i.usuario))];
  await db().from("referentes").upsert(usuarios.map((u) => ({ ig_username: u })), { onConflict: "ig_username", ignoreDuplicates: true });
  const { data: refs } = await db().from("referentes").select("id, ig_username").in("ig_username", usuarios);
  const idRef = new Map(((refs ?? []) as { id: string; ig_username: string }[]).map((r) => [r.ig_username, r.id]));

  const { data: existentes } = await db().from("publicaciones").select("ig_id, caption, transcripcion").in("ig_id", items.map((i) => i.codigo));
  const previo = new Map(((existentes ?? []) as { ig_id: string; caption: string | null; transcripcion: string | null }[]).map((e) => [e.ig_id, e]));

  let nuevos = 0;
  let conTranscripcion = 0;
  const altas: Record<string, unknown>[] = [];
  for (const i of items) {
    const p = previo.get(i.codigo);
    if (i.transcripcion) conTranscripcion++;
    const extra = {
      ...(i.transcripcion ? { transcripcion: i.transcripcion, hook: hookDeTranscripcion(i.transcripcion) } : {}),
    };
    if (!p) {
      nuevos++;
      altas.push({
        referente_id: idRef.get(i.usuario),
        ig_id: i.codigo,
        tipo: i.tipo,
        url: i.url,
        fecha_publicacion: i.fecha,
        vistas: i.vistas,
        likes: i.likes,
        comentarios: i.comentarios,
        caption: i.caption,
        palabra_clave: detectarPalabraClave(i.caption),
        cta_tipo: detectarCta(i.caption),
        ...extra,
      });
    } else {
      const cambios: Record<string, unknown> = { ...extra, updated_at: new Date().toISOString() };
      if (i.vistas !== null) cambios.vistas = i.vistas;
      if (i.likes !== null) cambios.likes = i.likes;
      if (i.comentarios !== null) cambios.comentarios = i.comentarios;
      if (!p.caption && i.caption) {
        cambios.caption = i.caption;
        cambios.palabra_clave = detectarPalabraClave(i.caption);
        cambios.cta_tipo = detectarCta(i.caption);
      }
      await db().from("publicaciones").update(cambios).eq("ig_id", i.codigo);
    }
  }
  for (let k = 0; k < altas.length; k += 200) {
    const { error } = await db().from("publicaciones").insert(altas.slice(k, k + 200));
    if (error) throw new Error(error.message);
  }
  await db().from("referentes").update({ ultima_sync: new Date().toISOString() }).in("ig_username", usuarios);

  return `Importado: ${items.length} publicaciones de ${usuarios.map((u) => `@${u}`).join(", ")} (${nuevos} nuevas${conTranscripcion ? `, ${conTranscripcion} con transcripción y hook` : ""}).`;
}
