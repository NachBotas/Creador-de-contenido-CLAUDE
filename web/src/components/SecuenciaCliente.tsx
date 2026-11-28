"use client";

import { useState } from "react";
import { BarraHistorias, Casilla, type ArchivoHistoria } from "./DescargaHistorias";
import VisorHistorias from "./VisorHistorias";

export type ItemSecuencia = ArchivoHistoria & {
  orden: number;
  hora: string;
  esVideo: boolean;
  video: string | null;
  imagen: string | null;
};

export default function SecuenciaCliente({ items, usuario }: { items: ItemSecuencia[]; usuario: string }) {
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<number | null>(null);
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
              <button
                type="button"
                onClick={() => setAbierta(h.orden - 1)}
                aria-label={`Ver historia ${h.orden} en grande`}
                className="group block w-full"
              >
                {h.borrada ? (
                  <div className="grid aspect-[9/16] w-full place-items-center px-3 text-center text-xs text-tenue">Descargada y borrada de la nube</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.imagen ?? ""} alt="" loading="lazy" className="aspect-[9/16] w-full object-cover transition group-hover:opacity-85" />
                )}
                {h.video && !h.borrada && (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid size-12 place-items-center rounded-full bg-black/60 text-xl text-white">▶</span>
                  </span>
                )}
              </button>
              <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-black/70 text-[11px] font-semibold text-white">{h.orden}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-tenue">
              {h.hora} · {h.esVideo ? "video" : "imagen"}
            </p>
          </li>
        ))}
      </ol>
      <VisorHistorias
        usuario={usuario}
        indice={abierta}
        setIndice={setAbierta}
        historias={items.map((i) => ({ id: i.id, video: i.video, imagen: i.imagen, hora: i.hora, borrada: i.borrada }))}
      />
    </>
  );
}
