"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Viral = { id: string; outlier: number; miniatura_url: string | null; caption: string | null; tipo: string; referentes: { ig_username: string } | null };
const CLAVE = "radar:ultima_visita_virales";

// Aviso en la app (sin mails) con los nuevos virales de 5x o más desde tu última visita.
export default function AlertasVirales() {
  const [virales, setVirales] = useState<Viral[]>([]);

  useEffect(() => {
    let desde = "";
    try {
      desde = localStorage.getItem(CLAVE) ?? "";
    } catch {
      /* sin almacenamiento: mostramos los de la última semana */
    }
    fetch(`/api/alertas${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Viral[]) => setVirales(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, []);

  if (!virales.length) return null;

  const listo = () => {
    try {
      localStorage.setItem(CLAVE, new Date().toISOString());
    } catch {
      /* nada */
    }
    setVirales([]);
  };

  return (
    <section aria-label="Nuevos virales" className="rounded-xl border border-ganador/40 bg-ganador/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          🔥 {virales.length} {virales.length === 1 ? "nuevo viral" : "nuevos virales"} (5x o más) desde tu última visita
        </p>
        <Link href="/?min=5&orden=outlier&dias=14" className="text-xs text-acento hover:underline">
          Ver todos
        </Link>
        <button type="button" onClick={listo} className="ml-auto h-8 rounded-md border border-borde px-3 text-xs hover:bg-panel">
          Ya los vi
        </button>
      </div>
      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {virales.map((v) => (
          <Link key={v.id} href={`/p/${v.id}`} scroll={false} className="w-28 shrink-0 overflow-hidden rounded-lg border border-borde bg-panel hover:border-suave/40">
            <div className="relative aspect-[9/14] bg-black">
              {v.miniatura_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.miniatura_url} alt="" loading="lazy" className="size-full object-cover" />
              )}
              <span className="absolute right-1 top-1 rounded bg-ganador px-1 text-[10px] font-bold text-black">{Number(v.outlier).toFixed(0)}x</span>
            </div>
            <p className="truncate px-1.5 py-1 text-[10px] text-suave">@{v.referentes?.ig_username}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
