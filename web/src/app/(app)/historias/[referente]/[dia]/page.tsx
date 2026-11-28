import Link from "next/link";
import { notFound } from "next/navigation";
import { listarReferentes, obtenerSecuencia } from "@/lib/datos";
import { diaLargo } from "@/lib/formato";
import SecuenciaCliente from "@/components/SecuenciaCliente";
import { nombreArchivo } from "@/components/GrillaHistorias";

export const dynamic = "force-dynamic";

export default async function Secuencia({ params }: { params: Promise<{ referente: string; dia: string }> }) {
  const { referente, dia } = await params;
  if (!/^[0-9a-f-]{36}$/.test(referente) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) notFound();
  const [historias, referentes] = await Promise.all([obtenerSecuencia(referente, dia), listarReferentes()]);
  const r = referentes.find((x) => x.id === referente);
  if (!r) notFound();

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href={`/?t=historias&referente=${referente}`} className="text-sm text-suave hover:text-texto">
        ← Volver a historias
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">
        @{r.ig_username} <span className="font-normal text-suave">· {diaLargo(dia)}</span>
        <span className="ml-2 text-sm font-normal text-tenue">
          {historias.length} {historias.length === 1 ? "historia" : "historias"}
        </span>
      </h1>
      {historias.length === 0 ? (
        <p className="text-sm text-suave">No hay historias guardadas ese día.</p>
      ) : (
        <SecuenciaCliente
          usuario={r.ig_username}
          items={historias.map((h, i) => {
            const esVideo = h.tipo_media === "video";
            const video = esVideo && h.media_url && h.media_url !== h.miniatura_url ? h.media_url : null;
            return {
              id: h.id,
              orden: i + 1,
              url: h.media_url ?? h.miniatura_url,
              nombre: nombreArchivo(h, r.ig_username),
              borrada: h.archivos_borrados,
              esVideo,
              video,
              imagen: h.miniatura_url,
              hora: new Date(h.fecha_publicacion).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }),
            };
          })}
        />
      )}
    </div>
  );
}
