import ExcelJS from "exceljs";
import { leerFiltros, listarFormatos, listarIdeas, listarPublicaciones, listarReferentes } from "@/lib/datos";
import type { Publicacion } from "@/lib/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Descarga en Excel lo que se está viendo (mismos filtros). Protegida por el middleware.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const vista = sp.vista_de ?? "todos"; // todos | reel | carrusel | ideas

  const [formatos, referentes] = await Promise.all([listarFormatos(), listarReferentes()]);
  let pubs: Publicacion[];
  if (vista === "ideas") pubs = await listarIdeas();
  else pubs = await listarPublicaciones(leerFiltros(sp, vista === "reel" || vista === "carrusel" ? vista : "todos"), 3000);

  const usuario = new Map(referentes.map((r) => [r.id, r.ig_username]));
  const formato = new Map(formatos.map((f) => [f.id, f.nombre]));

  const libro = new ExcelJS.Workbook();
  libro.creator = "Radar de contenido";
  const hoja = libro.addWorksheet(vista === "ideas" ? "Banco de ideas" : "Contenido", { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = [
    { header: "Referente", key: "referente", width: 18 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Formato", key: "formato", width: 16 },
    { header: "Fecha", key: "fecha", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Outlier", key: "outlier", width: 9, style: { numFmt: "0.0\"x\"" } },
    { header: "Ganador", key: "ganador", width: 9 },
    { header: "Vistas", key: "vistas", width: 12, style: { numFmt: "#,##0" } },
    { header: "Me gusta", key: "likes", width: 11, style: { numFmt: "#,##0" } },
    { header: "Comentarios", key: "comentarios", width: 12, style: { numFmt: "#,##0" } },
    { header: "% comentarios", key: "tasa", width: 13, style: { numFmt: "0.00\"%\"" } },
    { header: "Outlier comentarios", key: "outlierCom", width: 12, style: { numFmt: "0.0\"x\"" } },
    { header: "Palabra clave", key: "palabra", width: 14 },
    { header: "Hook", key: "hook", width: 40 },
    { header: "Descripción", key: "caption", width: 50 },
    { header: "Transcripción", key: "transcripcion", width: 60 },
    { header: "Link", key: "link", width: 40 },
  ];
  for (const p of pubs) {
    hoja.addRow({
      referente: `@${usuario.get(p.referente_id) ?? ""}`,
      tipo: p.tipo,
      formato: p.formato_id ? formato.get(p.formato_id) ?? "" : "",
      fecha: p.fecha_publicacion ? new Date(p.fecha_publicacion) : null,
      outlier: p.outlier !== null ? Number(p.outlier) : null,
      ganador: p.es_ganador ? "Sí" : "",
      vistas: p.tipo === "reel" ? p.vistas : null,
      likes: p.likes,
      comentarios: p.comentarios,
      tasa: p.tasa_comentarios !== null ? Number(p.tasa_comentarios) : null,
      outlierCom: p.outlier_comentarios !== null ? Number(p.outlier_comentarios) : null,
      palabra: p.palabra_clave ?? "",
      hook: p.hook ?? "",
      caption: p.caption ?? "",
      transcripcion: p.transcripcion ?? "",
      link: p.url ? { text: p.url, hyperlink: p.url } : "",
    });
  }
  hoja.getRow(1).font = { bold: true };
  hoja.autoFilter = { from: "A1", to: "P1" };

  const buffer = await libro.xlsx.writeBuffer();
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="radar-${vista}-${fecha}.xlsx"`,
    },
  });
}
