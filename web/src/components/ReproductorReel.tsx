"use client";

import { useEffect, useRef, useState } from "react";

const VELOCIDADES = [1, 1.25, 1.5, 1.75, 2];

// Reproductor propio para reels: velocidad de reproducción y descarga.
export default function ReproductorReel({ id, embed, nombreArchivo }: { id: string; embed: string; nombreArchivo: string }) {
  const [modo, setModo] = useState<"propio" | "instagram">("propio");
  const [velocidad, setVelocidad] = useState(1);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const video = useRef<HTMLVideoElement>(null);

  const deseada = useRef(1);

  // Algunos navegadores vuelven a 1x al arrancar o cargar más video: re-aplicamos la velocidad elegida.
  const aplicar = () => {
    const v = video.current;
    if (!v) return;
    v.defaultPlaybackRate = deseada.current;
    if (v.playbackRate !== deseada.current) v.playbackRate = deseada.current;
  };

  useEffect(() => {
    deseada.current = velocidad;
    aplicar();
  }, [velocidad, estado]);

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Reproductor" className="inline-flex self-center rounded-lg bg-panel-2 p-1 text-xs">
        {(
          [
            ["propio", "Con velocidad"],
            ["instagram", "Como en Instagram"],
          ] as const
        ).map(([m, t]) => (
          <button
            key={m}
            role="tab"
            aria-selected={modo === m}
            type="button"
            onClick={() => setModo(m)}
            className={`rounded-md px-3 py-1.5 font-medium ${modo === m ? "bg-fondo text-texto" : "text-suave hover:text-texto"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {modo === "propio" ? (
        <div className="mx-auto w-full max-w-[400px]">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video
              ref={video}
              src={`/api/reel/${id}/video`}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={() => {
                setEstado("listo");
                aplicar();
              }}
              onLoadedData={aplicar}
              onPlay={aplicar}
              onPlaying={aplicar}
              onSeeked={aplicar}
              onCanPlay={aplicar}
              onRateChange={() => {
                // Si la cambiaste desde el menú del video, el botón acompaña.
                const r = video.current?.playbackRate;
                if (r && Math.abs(r - deseada.current) > 0.01 && VELOCIDADES.includes(r)) {
                  deseada.current = r;
                  setVelocidad(r);
                }
              }}
              onError={() => setEstado("error")}
              className="aspect-[9/16] w-full object-contain"
            />
            {estado === "cargando" && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60 px-6 text-center text-xs text-white/80">
                Cargando video… si es un reel viejo, Instagram tarda unos segundos en darlo de nuevo.
              </div>
            )}
            {estado === "error" && (
              <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center text-sm text-white/80">
                <div className="flex flex-col items-center gap-2">
                  No se pudo cargar el video.
                  <button type="button" onClick={() => setModo("instagram")} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
                    Verlo como en Instagram
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-center gap-1" role="group" aria-label="Velocidad">
            {VELOCIDADES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  deseada.current = v;
                  setVelocidad(v);
                  aplicar();
                }}
                aria-pressed={velocidad === v}
                className={`h-8 min-w-12 rounded-md px-2 text-xs font-semibold tabular-nums ${velocidad === v ? "bg-acento text-black" : "bg-panel-2 text-suave hover:text-texto"}`}
              >
                {v}x
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-xl bg-white">
          <iframe src={embed} title="Reel en Instagram" className="block h-[700px] w-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
        </div>
      )}

      <a
        href={`/api/reel/${id}/video?descargar=1&nombre=${encodeURIComponent(nombreArchivo)}`}
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-borde px-3 text-sm hover:bg-panel-2"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        Descargar reel (.mp4)
      </a>
    </div>
  );
}
