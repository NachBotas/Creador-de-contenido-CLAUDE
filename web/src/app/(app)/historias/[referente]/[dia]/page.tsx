import Link from "next/link";
import { notFound } from "next/navigation";
import { listarReferentes, obtenerSecuencia } from "@/lib/datos";
import { diaLargo } from "@/lib/formato";

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
        <ol className="flex gap-3 overflow-x-auto pb-4" aria-label="Secuencia de historias">
          {historias.map((h, i) => (
            <li key={h.id} className="w-52 shrink-0">
              <div className="relative overflow-hidden rounded-xl border border-borde bg-black">
                {h.drive_archivo_id && h.tipo_media === "video" ? (
                  <iframe
                    src={`https://drive.google.com/file/d/${h.drive_archivo_id}/preview`}
                    title={`Historia ${i + 1}`}
                    allow="autoplay"
                    className="aspect-[9/16] w-full border-0"
                    loading="lazy"
                  />
                ) : h.tipo_media === "video" && h.media_url && h.media_url !== h.miniatura_url ? (
                  <video src={h.media_url} poster={h.miniatura_url ?? undefined} controls preload="none" className="aspect-[9/16] w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.miniatura_url ?? ""} alt={`Historia ${i + 1}`} className="aspect-[9/16] w-full object-cover" />
                )}
                <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-black/70 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-tenue">
                {new Date(h.fecha_publicacion).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}
                {h.tipo_media === "video" ? " · video" : " · imagen"}
                {h.drive_archivo_id && (
                  <>
                    {" · "}
                    <a href={`https://drive.google.com/file/d/${h.drive_archivo_id}/view`} target="_blank" rel="noreferrer" className="text-acento hover:underline">
                      Drive ↗
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
