"use client";

import { useEffect, useRef, useState } from "react";

type Estado =
  | { fase: "quieto" }
  | { fase: "convirtiendo"; pct: number }
  | { fase: "bajando"; pct: number | null }
  | { fase: "listo" }
  | { fase: "error"; mensaje: string };

// Botón de descarga con barra de progreso. Si el reel hay que convertirlo, muestra el avance estimado.
export default function DescargaReel({ id, nombre, convertir, duracion }: { id: string; nombre: string; convertir: boolean; duracion: number | null }) {
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lo terminado (o fallado) se va solo a los pocos segundos.
  useEffect(() => {
    if (estado.fase !== "listo" && estado.fase !== "error") return;
    const t = setTimeout(() => setEstado({ fase: "quieto" }), estado.fase === "listo" ? 5000 : 10000);
    return () => clearTimeout(t);
  }, [estado.fase]);

  useEffect(() => () => {
    if (reloj.current) clearInterval(reloj.current);
  }, []);

  const descargar = async () => {
    // Estimación de la conversión: ~0,5 s por segundo de video (+ lo que tarda en traerlo de Instagram).
    const estimado = Math.max(15, (duracion ?? 60) * 0.5 + 8) * 1000;
    const inicio = Date.now();
    if (convertir) {
      setEstado({ fase: "convirtiendo", pct: 0 });
      reloj.current = setInterval(() => {
        const x = (Date.now() - inicio) / estimado;
        setEstado((e) => (e.fase === "convirtiendo" ? { fase: "convirtiendo", pct: Math.min(95, Math.round(95 * (1 - Math.exp(-2.2 * x)))) } : e));
      }, 400);
    } else {
      setEstado({ fase: "bajando", pct: null });
    }
    try {
      const r = await fetch(`/api/reel/${id}/descargar?nombre=${encodeURIComponent(nombre)}`);
      if (reloj.current) clearInterval(reloj.current);
      if (!r.ok || !r.body) throw new Error((await r.text().catch(() => "")) || "No se pudo descargar");
      const total = Number(r.headers.get("content-length")) || 0;
      const lector = r.body.getReader();
      const partes: Uint8Array[] = [];
      let recibido = 0;
      setEstado({ fase: "bajando", pct: total ? 0 : null });
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        partes.push(value);
        recibido += value.length;
        if (total) setEstado({ fase: "bajando", pct: Math.round((recibido / total) * 100) });
      }
      const url = URL.createObjectURL(new Blob(partes as BlobPart[], { type: "video/mp4" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setEstado({ fase: "listo" });
    } catch (e) {
      if (reloj.current) clearInterval(reloj.current);
      setEstado({ fase: "error", mensaje: (e as Error).message });
    }
  };

  const ocupado = estado.fase === "convirtiendo" || estado.fase === "bajando";
  const pct = estado.fase === "convirtiendo" || estado.fase === "bajando" ? estado.pct : estado.fase === "listo" ? 100 : null;
  const texto =
    estado.fase === "convirtiendo"
      ? `Preparando el video con sonido… ${estado.pct}%`
      : estado.fase === "bajando"
        ? `Descargando…${estado.pct !== null ? ` ${estado.pct}%` : ""}`
        : estado.fase === "listo"
          ? "¡Listo! Ya está en tus descargas"
          : estado.fase === "error"
            ? `No se pudo: ${estado.mensaje}`
            : "Descargar reel (.mp4)";

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={descargar}
        disabled={ocupado}
        aria-live="polite"
        className={`relative flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg border px-3 text-sm ${
          estado.fase === "error" ? "border-peligro/40 text-peligro" : estado.fase === "listo" ? "border-acento/40 text-acento" : "border-borde hover:bg-panel-2"
        } disabled:cursor-wait`}
      >
        {pct !== null && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-acento/15 transition-all duration-500" style={{ width: `${pct}%` }} />}
        {ocupado && pct === null && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1/3 animate-pulse bg-acento/15" />}
        <span className="relative flex items-center gap-2">
          {estado.fase === "quieto" && (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          )}
          {texto}
        </span>
      </button>
      {estado.fase === "convirtiendo" && (
        <p className="text-center text-xs text-tenue">Instagram mandó este reel en un formato raro: lo pasamos a MP4 normal. Tarda ~{Math.round(Math.max(15, (duracion ?? 60) * 0.5 + 8))} s.</p>
      )}
    </div>
  );
}
