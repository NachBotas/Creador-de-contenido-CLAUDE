import Link from "next/link";
import type { Secuencia } from "@/lib/datos";
import type { Referente } from "@/lib/tipos";
import { diaLargo } from "@/lib/formato";
import { Vacio } from "./Encabezado";

// Historias agrupadas en secuencias por cuenta y por día.
export default function GrillaHistorias({ secuencias, refPorId }: { secuencias: Secuencia[]; refPorId: Map<string, Referente> }) {
  if (!secuencias.length) {
    return (
      <Vacio
        titulo="No hay historias en este período"
        texto="Las historias se capturan una vez por día y duran 24 h en Instagram. Elegí de qué cuentas capturarlas en Referentes → Sincronización automática."
      />
    );
  }
  const porDia = new Map<string, Secuencia[]>();
  for (const s of secuencias) porDia.set(s.dia, [...(porDia.get(s.dia) ?? []), s]);
  return (
    <>
      {[...porDia.entries()].map(([dia, lista]) => (
        <section key={dia} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium first-letter:uppercase">
            {diaLargo(dia)} <span className="text-xs font-normal text-tenue">· {lista.length} {lista.length === 1 ? "cuenta" : "cuentas"}</span>
          </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {lista.map((s) => {
              const r = refPorId.get(s.referenteId);
              const portada = s.historias[0];
              return (
                <Link
                  key={`${s.referenteId}${s.dia}`}
                  href={`/historias/${s.referenteId}/${s.dia}`}
                  className="group overflow-hidden rounded-xl border border-borde bg-panel transition hover:border-suave/40"
                >
                  <div className="relative aspect-[9/16] bg-black">
                    {portada?.miniatura_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={portada.miniatura_url} alt="" loading="lazy" className="size-full object-cover transition group-hover:opacity-90" />
                    )}
                    <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                      {s.historias.length}
                    </span>
                    {s.activa && (
                      <span className="absolute right-2 top-2 rounded-md bg-acento px-1.5 py-0.5 text-[10px] font-semibold text-black">Activa</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 p-2 text-xs">
                    {r?.foto_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.foto_url} alt="" className="size-4 rounded-full object-cover" />
                    )}
                    <span className="truncate">@{r?.ig_username}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
