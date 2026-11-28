import type { Secuencia } from "@/lib/datos";
import type { Historia, Referente } from "@/lib/tipos";
import { diaLargo } from "@/lib/formato";
import { Vacio } from "./Encabezado";
import GrillaHistoriasCliente, { type TarjetaSecuencia } from "./GrillaHistoriasCliente";

export function nombreArchivo(h: Historia, usuario: string): string {
  const f = new Date(h.fecha_publicacion);
  const dia = f.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const hora = f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).replace(":", "");
  const esVideo = h.tipo_media === "video" && h.media_url && h.media_url !== h.miniatura_url;
  return `@${usuario}/${dia}/${hora}_${h.ig_id}.${esVideo ? "mp4" : "jpg"}`;
}

// Historias agrupadas en secuencias por cuenta y por día, con selección para descargar o borrar.
export default function GrillaHistorias({ secuencias, refPorId }: { secuencias: Secuencia[]; refPorId: Map<string, Referente> }) {
  if (!secuencias.length) {
    return (
      <Vacio
        titulo="No hay historias en este período"
        texto="Las historias se capturan una vez por día y duran 24 h en Instagram. Elegí de qué cuentas capturarlas en Referentes → Sincronización automática."
      />
    );
  }
  const tarjetas: TarjetaSecuencia[] = secuencias.map((s) => {
    const r = refPorId.get(s.referenteId);
    const usuario = r?.ig_username ?? "cuenta";
    const portada = s.historias.find((h) => h.miniatura_url)?.miniatura_url ?? null;
    return {
      clave: `${s.referenteId}|${s.dia}`,
      href: `/historias/${s.referenteId}/${s.dia}`,
      dia: s.dia,
      diaTexto: diaLargo(s.dia),
      usuario,
      foto: r?.foto_url ?? null,
      portada,
      activa: s.activa,
      archivos: s.historias.map((h) => ({
        id: h.id,
        url: h.media_url ?? h.miniatura_url,
        nombre: nombreArchivo(h, usuario),
        borrada: h.archivos_borrados,
      })),
    };
  });
  return <GrillaHistoriasCliente tarjetas={tarjetas} />;
}
