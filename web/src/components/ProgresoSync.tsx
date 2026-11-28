"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EstadoSync } from "@/lib/apify";

const TEXTO: Record<string, string> = {
  corriendo: "Trayendo de Instagram…",
  guardando: "Guardando en tu base…",
  listo: "Listo",
  error: "Falló",
};

// Muestra las sincronizaciones en curso y las terminadas en los últimos minutos.
export default function ProgresoSync() {
  const router = useRouter();
  const [lista, setLista] = useState<EstadoSync[]>([]);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const vistasListas = useRef<Set<string>>(new Set());
  const primera = useRef(true);

  useEffect(() => {
    let cancelado = false;
    let espera: ReturnType<typeof setTimeout>;
    const consultar = async () => {
      const datos = (await fetch("/api/sincronizaciones", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => [])) as EstadoSync[];
      if (cancelado) return;
      setLista(datos);
      // Cuando algo termina, refrescamos la página para mostrar lo nuevo.
      const recienTerminadas = datos.filter((d) => d.estado === "listo" && !vistasListas.current.has(d.id));
      recienTerminadas.forEach((d) => vistasListas.current.add(d.id));
      if (recienTerminadas.length && !primera.current) router.refresh();
      primera.current = false;
      const activas = datos.some((d) => d.estado === "corriendo" || d.estado === "guardando");
      espera = setTimeout(consultar, activas ? 3000 : 15000);
    };
    consultar();
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [router]);

  const visibles = lista.filter(
    (s) =>
      !ocultas.has(s.id) &&
      (s.estado === "corriendo" || s.estado === "guardando" || (s.terminado_at && Date.now() - new Date(s.terminado_at).getTime() < 10 * 60_000)),
  );
  if (!visibles.length) return null;

  return (
    <section aria-label="Sincronizaciones" aria-live="polite" className="flex flex-col gap-2">
      {visibles.map((s) => {
        const activa = s.estado === "corriendo" || s.estado === "guardando";
        const pct =
          s.estado === "listo" ? 100 : s.estado === "guardando" ? 92 : s.esperado && s.traidos !== null ? Math.min(88, Math.round((s.traidos / s.esperado) * 88)) : null;
        const minutos = Math.max(0, Math.round((Date.now() - new Date(s.created_at).getTime()) / 60_000));
        return (
          <div key={s.id} className={`rounded-xl border p-3 ${s.estado === "error" ? "border-peligro/40 bg-peligro/10" : s.estado === "listo" ? "border-acento/30 bg-acento/5" : "border-borde bg-panel"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium">{s.etiqueta}</span>
              <span className={s.estado === "error" ? "text-peligro" : s.estado === "listo" ? "text-acento" : "text-suave"}>
                {TEXTO[s.estado] ?? s.estado}
                {s.estado === "corriendo" && s.traidos !== null ? ` ${s.traidos}${s.esperado ? ` de hasta ${s.esperado}` : ""} traídos` : ""}
                {s.estado === "listo" && s.guardados !== null ? `: ${s.guardados} ${s.tipo === "historias" ? "historias nuevas" : "publicaciones guardadas"}` : ""}
                {s.estado === "error" && s.mensaje ? ` · ${s.mensaje}` : ""}
              </span>
              <span className="ml-auto text-xs text-tenue">{activa ? `hace ${minutos} min` : ""}</span>
              {!activa && (
                <button type="button" onClick={() => setOcultas(new Set([...ocultas, s.id]))} className="text-xs text-tenue hover:text-texto" aria-label="Ocultar aviso">
                  ×
                </button>
              )}
            </div>
            {s.estado !== "error" && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
                {pct === null ? (
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-acento/70" />
                ) : (
                  <div className="h-full rounded-full bg-acento transition-all duration-700" style={{ width: `${pct}%` }} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
