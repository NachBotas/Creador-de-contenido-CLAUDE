"use client";

import { useCallback, useEffect, useRef } from "react";

export type HistoriaVisor = { id: string; video: string | null; imagen: string | null; hora: string; borrada: boolean };

// Visor vertical a pantalla completa, estilo Instagram: flechas, teclado y avance automático.
export default function VisorHistorias({
  historias,
  indice,
  setIndice,
  usuario,
}: {
  historias: HistoriaVisor[];
  indice: number | null;
  setIndice: (i: number | null) => void;
  usuario: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = historias.length;
  const actual = indice === null ? null : historias[indice];

  const ir = useCallback(
    (delta: number) => {
      if (indice === null) return;
      const n = indice + delta;
      if (n < 0) return;
      if (n >= total) setIndice(null);
      else setIndice(n);
    },
    [indice, total, setIndice],
  );

  useEffect(() => {
    if (indice === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndice(null);
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [indice, ir, setIndice]);

  // Las imágenes pasan solas a los 6 segundos, como en Instagram.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (actual && !actual.video && !actual.borrada) timer.current = setTimeout(() => ir(1), 6000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [actual, ir]);

  if (indice === null || !actual) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" role="dialog" aria-modal="true" aria-label={`Historias de @${usuario}`}>
      <button type="button" aria-label="Cerrar" onClick={() => setIndice(null)} className="absolute inset-0 cursor-default" tabIndex={-1} />

      <div className="relative flex h-[96svh] max-w-[96vw] flex-col gap-2" style={{ aspectRatio: "9 / 16" }}>
        {/* Barras de progreso */}
        <div className="flex gap-1 px-1 pt-1">
          {historias.map((h, i) => (
            <span key={h.id} className={`h-0.5 flex-1 rounded-full ${i <= indice ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between px-1 text-xs text-white/80">
          <span>
            @{usuario} · {actual.hora}
          </span>
          <span className="tabular-nums">
            {indice + 1} de {total}
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
          {actual.borrada ? (
            <div className="grid size-full place-items-center text-sm text-white/60">Descargada y borrada de la nube</div>
          ) : actual.video ? (
            <video
              key={actual.id}
              ref={videoRef}
              src={actual.video}
              poster={actual.imagen ?? undefined}
              autoPlay
              controls
              playsInline
              controlsList="nofullscreen"
              onEnded={() => ir(1)}
              className="size-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={actual.id} src={actual.imagen ?? ""} alt={`Historia ${indice + 1}`} className="size-full object-contain" />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => ir(-1)}
        disabled={indice === 0}
        aria-label="Historia anterior"
        className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 disabled:opacity-20 sm:left-8"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => ir(1)}
        aria-label="Historia siguiente"
        className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 sm:right-8"
      >
        ›
      </button>
      <button
        type="button"
        onClick={() => setIndice(null)}
        aria-label="Cerrar"
        className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
      >
        ×
      </button>
    </div>
  );
}
