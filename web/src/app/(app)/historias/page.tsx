import Link from "next/link";
import { listarReferentes, listarSecuencias } from "@/lib/datos";
import { diaLargo } from "@/lib/formato";
import Encabezado, { Vacio } from "@/components/Encabezado";

export const dynamic = "force-dynamic";
export const metadata = { title: "Historias · Radar de contenido" };

type SP = Record<string, string | string[] | undefined>;
const PERIODOS = [
  ["7", "7 días"],
  ["30", "30 días"],
  ["90", "3 meses"],
] as const;

export default async function Historias({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const dias = [7, 30, 90].includes(Number(sp.dias)) ? Number(sp.dias) : 7;
  const referente = typeof sp.referente === "string" ? sp.referente : "";
  const [referentes, secuencias] = await Promise.all([listarReferentes(), listarSecuencias(dias, referente)]);
  const refPorId = new Map(referentes.map((r) => [r.id, r]));

  const porDia = new Map<string, typeof secuencias>();
  for (const s of secuencias) porDia.set(s.dia, [...(porDia.get(s.dia) ?? []), s]);

  const link = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ dias: String(dias), ...(referente ? { referente } : {}), ...cambios });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `?${p}`;
  };

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado
        titulo="Historias"
        bajada={`Secuencias por cuenta y por día · ${secuencias.length} ${secuencias.length === 1 ? "secuencia" : "secuencias"}`}
      >
        <div role="tablist" aria-label="Período" className="inline-flex rounded-lg bg-panel p-1 text-xs">
          {PERIODOS.map(([v, t]) => (
            <Link
              key={v}
              role="tab"
              aria-selected={String(dias) === v}
              href={link({ dias: v })}
              className={`rounded-md px-3 py-1.5 font-medium ${String(dias) === v ? "bg-panel-2 text-texto" : "text-suave hover:text-texto"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      </Encabezado>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {[{ id: "", ig_username: "" }, ...referentes].map((r) => (
          <Link
            key={r.id || "todas"}
            href={link({ referente: r.id })}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm ${
              referente === r.id ? "border-acento/50 bg-acento/10 text-texto" : "border-borde text-suave hover:text-texto"
            }`}
          >
            {r.id ? `@${r.ig_username}` : "Todas"}
          </Link>
        ))}
      </div>

      {secuencias.length === 0 ? (
        <Vacio
          titulo="No hay historias en este período"
          texto="Las historias se capturan una vez por día y duran 24 h en Instagram. Activá «Historias» en tus referentes para empezar a guardarlas."
        />
      ) : (
        [...porDia.entries()].map(([dia, lista]) => (
          <section key={dia} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">
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
        ))
      )}
    </div>
  );
}
