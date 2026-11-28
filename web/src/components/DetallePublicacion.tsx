import { comentariosDe } from "@/lib/datos";
import { fechaCorta, multiplicador, numero } from "@/lib/formato";
import type { Formato, Publicacion, Referente } from "@/lib/tipos";
import { BotonIdea, BotonTranscribir, Pestanas } from "./Interactivos";
import SelectorFormato from "./SelectorFormato";
import ReproductorReel from "./ReproductorReel";
import { videoSinAudio } from "@/lib/video";

const ETIQUETA = { reel: "Reel", carrusel: "Carrusel", imagen: "Imagen" } as const;

// Contenido de la ficha de una publicación: reproductor de Instagram a la izquierda, pestañas a la derecha.
export default async function DetallePublicacion({
  p,
  referente,
  formatos,
  guardada,
}: {
  p: Publicacion;
  referente?: Referente;
  formatos: Formato[];
  guardada: boolean;
}) {
  const comentarios = await comentariosDe(p.id);
  const esReel = p.tipo === "reel";
  const embed = `https://www.instagram.com/${esReel ? "reel" : "p"}/${p.ig_id}/embed/`;
  const linkIg = p.url ?? `https://www.instagram.com/p/${p.ig_id}/`;
  const tr = p.analisis?.transcripcion;

  const pestanas = [
    ...(esReel
      ? [
          {
            id: "transcripcion",
            titulo: "Transcripción",
            contenido: p.transcripcion ? (
              <div className="flex flex-col gap-4">
                {p.hook && (
                  <div className="rounded-xl border border-acento/30 bg-acento/10 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-acento">Hook · primeros 3 segundos</p>
                    <p className="mt-1 text-base font-medium">“{p.hook}”</p>
                  </div>
                )}
                {tr?.segmentos?.length ? (
                  <ol className="flex flex-col gap-2">
                    {tr.segmentos.map((s, i) => (
                      <li key={i} className="grid grid-cols-[3.25rem_1fr] gap-2 text-sm leading-relaxed">
                        <span className="pt-0.5 text-xs tabular-nums text-tenue">{formatearSeg(s.start)}</span>
                        <span>{s.text}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.transcripcion}</p>
                )}
                {tr?.texto_en_pantalla && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-suave">Texto en pantalla</p>
                    <p className="whitespace-pre-wrap text-sm text-suave">{tr.texto_en_pantalla}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-borde px-6 py-12 text-center">
                <p className="font-medium">Leé el reel palabra por palabra</p>
                <p className="mt-1 max-w-sm text-sm text-suave">
                  Tocá <strong>Transcribir</strong> para obtener el texto completo, el hook y los tiempos de cada frase. Cuesta 1,5 centavos de Apify.
                </p>
              </div>
            ),
          },
        ]
      : []),
    {
      id: "descripcion",
      titulo: "Descripción",
      contenido: (
        <div className="flex flex-col gap-3">
          {p.palabra_clave && (
            <p className="w-fit rounded-md bg-acento/15 px-2 py-1 text-sm font-semibold text-acento">Pide comentar: {p.palabra_clave}</p>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-suave">{p.caption || "Sin descripción."}</p>
          <p className="text-xs text-tenue">Publicado el {fechaCorta(p.fecha_publicacion)}</p>
        </div>
      ),
    },
    {
      id: "resultados",
      titulo: "Resultados",
      contenido: (
        <div className="flex flex-col gap-3">
          <div className={`flex items-center gap-4 rounded-xl border p-4 ${p.es_ganador ? "border-ganador/50 bg-ganador/10" : "border-borde bg-panel-2"}`}>
            <span className="text-3xl font-semibold tabular-nums">{multiplicador(p.outlier)}</span>
            <span className="text-sm text-suave">
              Rendimiento frente a lo normal de la cuenta
              {p.tipo !== "reel" ? " (con likes: las vistas de carruseles no son públicas)" : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {esReel && <Metrica titulo="Reproducciones" valor={numero(p.vistas)} />}
            <Metrica titulo="Me gusta" valor={numero(p.likes)} />
            <Metrica titulo="Comentarios" valor={numero(p.comentarios)} />
            <Metrica titulo="Outlier de comentarios" valor={multiplicador(p.outlier_comentarios)} />
            <Metrica titulo="% de comentarios" valor={p.tasa_comentarios !== null ? `${p.tasa_comentarios.toFixed(2)}%` : "—"} />
            {esReel && p.duracion_seg ? <Metrica titulo="Duración" valor={formatearSeg(p.duracion_seg)} /> : null}
          </div>
        </div>
      ),
    },
    {
      id: "comentarios",
      titulo: `Comentarios (${comentarios.length})`,
      contenido: comentarios.length ? (
        <ul className="flex flex-col divide-y divide-borde">
          {comentarios.map((c) => (
            <li key={c.id} className="py-3 text-sm first:pt-0">
              <span className="text-xs text-tenue">@{c.usuario}</span>
              <p className="mt-0.5">{c.texto}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-tenue">Todavía no hay comentarios guardados de esta publicación.</p>
      ),
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,400px)_1fr]">
      <div className="flex flex-col gap-3">
        {esReel ? (
          <ReproductorReel id={p.id} embed={embed} audioAparte={videoSinAudio(p.media_url)} duracion={p.duracion_seg} nombreArchivo={`${referente?.ig_username ?? "reel"}_${p.ig_id}.mp4`} />
        ) : (
          <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-xl bg-white">
            <iframe
              src={embed}
              title={`Publicación de @${referente?.ig_username ?? "Instagram"}`}
              className="block h-[620px] w-full border-0"
              allow="autoplay; encrypted-media; fullscreen; clipboard-write"
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}
        <div className={`grid gap-2 ${esReel ? "grid-cols-2" : "grid-cols-1"}`}>
          <a href={linkIg} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-lg border border-borde px-3 text-sm hover:bg-panel-2">
            Abrir en Instagram ↗
          </a>
          {esReel && <BotonTranscribir id={p.id} yaTiene={Boolean(p.transcripcion)} />}
        </div>
        <BotonIdea id={p.id} guardada={guardada} />
        {esReel && (
          <label className="flex flex-col gap-1.5 text-xs text-suave">
            Formato de este reel
            <SelectorFormato id={p.id} actual={p.formato_id} formatos={formatos} />
          </label>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs text-suave">
          {referente ? `@${referente.ig_username}` : ""} · <span className="rounded bg-panel-2 px-1.5 py-0.5">{ETIQUETA[p.tipo]}</span> ·{" "}
          {fechaCorta(p.fecha_publicacion)}
          {p.fijado ? " · fijado" : ""}
        </p>
        <h2 className="mb-5 mt-1 line-clamp-2 text-lg font-semibold">{p.caption?.split("\n")[0] || "Sin texto"}</h2>
        <Pestanas pestanas={pestanas} />
      </div>
    </div>
  );
}

function formatearSeg(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function Metrica({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-borde bg-panel-2 p-3">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
