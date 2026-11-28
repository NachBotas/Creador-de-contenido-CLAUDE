"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarraHistorias, Casilla, type ArchivoHistoria } from "./DescargaHistorias";

export type TarjetaSecuencia = {
  clave: string;
  href: string;
  dia: string;
  diaTexto: string;
  usuario: string;
  foto: string | null;
  portada: string | null;
  activa: boolean;
  archivos: ArchivoHistoria[];
};

export default function GrillaHistoriasCliente({ tarjetas }: { tarjetas: TarjetaSecuencia[] }) {
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const todas = useMemo(() => tarjetas.flatMap((t) => t.archivos), [tarjetas]);
  const porDia = useMemo(() => {
    const m = new Map<string, TarjetaSecuencia[]>();
    for (const t of tarjetas) m.set(t.dia, [...(m.get(t.dia) ?? []), t]);
    return [...m.entries()];
  }, [tarjetas]);

  const alternar = (t: TarjetaSecuencia) => {
    const ids = t.archivos.filter((a) => !a.borrada && a.url).map((a) => a.id);
    const n = new Set(elegidas);
    const todasMarcadas = ids.length > 0 && ids.every((id) => n.has(id));
    for (const id of ids) (todasMarcadas ? n.delete(id) : n.add(id));
    setElegidas(n);
  };

  return (
    <>
      <BarraHistorias elegidas={todas.filter((a) => elegidas.has(a.id))} todas={todas} setElegidas={setElegidas} />
      {porDia.map(([dia, lista]) => (
        <section key={dia} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium first-letter:uppercase">
            {lista[0].diaTexto} <span className="text-xs font-normal text-tenue">· {lista.length} {lista.length === 1 ? "cuenta" : "cuentas"}</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {lista.map((t) => {
              const ids = t.archivos.filter((a) => !a.borrada && a.url).map((a) => a.id);
              const marcada = ids.length > 0 && ids.every((id) => elegidas.has(id));
              const borradas = t.archivos.filter((a) => a.borrada).length;
              return (
                <div key={t.clave} className={`group relative overflow-hidden rounded-xl border bg-panel transition ${marcada ? "border-acento" : "border-borde hover:border-suave/40"}`}>
                  {ids.length > 0 && <Casilla marcada={marcada} onChange={() => alternar(t)} etiqueta={`Seleccionar historias de @${t.usuario}`} />}
                  <Link href={t.href} className="block">
                    <div className="relative aspect-[9/16] bg-black">
                      {t.portada ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.portada} alt="" loading="lazy" className="size-full object-cover transition group-hover:opacity-90" />
                      ) : (
                        <div className="grid size-full place-items-center px-2 text-center text-[11px] text-tenue">Descargadas y borradas de la nube</div>
                      )}
                      <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                        {t.archivos.length}
                        {borradas ? ` · ${borradas} borradas` : ""}
                      </span>
                      {t.activa && <span className="absolute right-2 top-2 rounded-md bg-acento px-1.5 py-0.5 text-[10px] font-semibold text-black">Activa</span>}
                    </div>
                    <div className="flex items-center gap-1.5 p-2 text-xs">
                      {t.foto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.foto} alt="" className="size-4 rounded-full object-cover" />
                      )}
                      <span className="truncate">@{t.usuario}</span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
