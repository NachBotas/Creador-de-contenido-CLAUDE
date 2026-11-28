"use client";

import { useState } from "react";
import { BarraHistorias, Casilla, type ArchivoHistoria } from "./DescargaHistorias";

export type ItemSecuencia = ArchivoHistoria & {
  orden: number;
  hora: string;
  esVideo: boolean;
  video: string | null;
  imagen: string | null;
};

export default function SecuenciaCliente({ items }: { items: ItemSecuencia[] }) {
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const alternar = (id: string) => {
    const n = new Set(elegidas);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setElegidas(n);
  };
  return (
    <>
      <BarraHistorias elegidas={items.filter((i) => elegidas.has(i.id))} todas={items} setElegidas={setElegidas} />
      <ol className="flex gap-3 overflow-x-auto pb-4" aria-label="Secuencia de historias">
        {items.map((h) => (
          <li key={h.id} className="w-52 shrink-0">
            <div className={`relative overflow-hidden rounded-xl border bg-black ${elegidas.has(h.id) ? "border-acento" : "border-borde"}`}>
              {!h.borrada && h.url && <Casilla marcada={elegidas.has(h.id)} onChange={() => alternar(h.id)} etiqueta={`Seleccionar historia ${h.orden}`} />}
              {h.borrada ? (
                <div className="grid aspect-[9/16] w-full place-items-center px-3 text-center text-xs text-tenue">Descargada y borrada de la nube</div>
              ) : h.video ? (
                <video src={h.video} poster={h.imagen ?? undefined} controls preload="none" className="aspect-[9/16] w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.imagen ?? ""} alt={`Historia ${h.orden}`} className="aspect-[9/16] w-full object-cover" />
              )}
              <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-black/70 text-[11px] font-semibold text-white">{h.orden}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-tenue">
              {h.hora} · {h.esVideo ? "video" : "imagen"}
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}
