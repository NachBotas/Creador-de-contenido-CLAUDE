"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarIdea, quitarIdea } from "@/app/acciones";

export function Pestanas({ pestanas }: { pestanas: { id: string; titulo: string; contenido: React.ReactNode }[] }) {
  const [activa, setActiva] = useState(pestanas[0]?.id);
  return (
    <div className="flex min-h-0 flex-col">
      <div role="tablist" className="flex gap-5 border-b border-borde">
        {pestanas.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={activa === p.id}
            onClick={() => setActiva(p.id)}
            className={`-mb-px border-b-2 pb-2.5 text-sm transition ${
              activa === p.id ? "border-acento font-medium text-texto" : "border-transparent text-suave hover:text-texto"
            }`}
          >
            {p.titulo}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-5">
        {pestanas.find((p) => p.id === activa)?.contenido}
      </div>
    </div>
  );
}

export function BotonTranscribir({ id, yaTiene }: { id: string; yaTiene: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "trabajando" | "error">("listo");
  const [error, setError] = useState("");
  const [, iniciar] = useTransition();

  async function transcribir() {
    setEstado("trabajando");
    setError("");
    try {
      const res = await fetch("/api/transcribir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al transcribir");
      setEstado("listo");
      iniciar(() => router.refresh());
    } catch (e) {
      setEstado("error");
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={transcribir}
        disabled={estado === "trabajando"}
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-borde px-3 text-sm hover:bg-panel-2 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" />
        </svg>
        {estado === "trabajando" ? "Transcribiendo… (~30 s)" : yaTiene ? "Volver a transcribir" : "Transcribir"}
      </button>
      {estado === "error" && <p className="text-xs text-peligro">{error}</p>}
    </div>
  );
}

export function BotonIdea({ id, guardada }: { id: string; guardada: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      onClick={() => iniciar(() => (guardada ? quitarIdea(id) : guardarIdea(id)))}
      disabled={pendiente}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 ${
        guardada ? "border border-acento/50 bg-acento/10 text-acento" : "bg-acento text-black hover:bg-acento-osc"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill={guardada ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z" />
      </svg>
      {pendiente ? "Guardando…" : guardada ? "Guardada en el banco · quitar" : "Guardar idea"}
    </button>
  );
}

// Cierra el modal con Escape y bloquea el scroll del fondo.
export function ControlModal({ hrefCerrar }: { hrefCerrar: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.push(hrefCerrar, { scroll: false });
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [hrefCerrar, router]);
  return null;
}
