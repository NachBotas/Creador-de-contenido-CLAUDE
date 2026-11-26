import Link from "next/link";
import type { Referente } from "@/lib/tipos";
import { numero } from "@/lib/formato";

// Lista de referentes a la izquierda: elegís uno para verlo solo, o "Todos".
export default function PanelReferentes({
  referentes,
  activo,
  enlace,
}: {
  referentes: Referente[];
  activo: string;
  enlace: (id: string) => string;
}) {
  const fila = (on: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${on ? "bg-panel-2 text-texto ring-1 ring-borde" : "text-suave hover:bg-panel-2/60 hover:text-texto"}`;
  return (
    <aside aria-label="Referentes" className="flex flex-col gap-1 rounded-xl border border-borde bg-panel p-2 lg:sticky lg:top-6">
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-tenue">Referentes</p>
      <Link href={enlace("")} scroll={false} aria-current={!activo ? "true" : undefined} className={fila(!activo)}>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-acento/15 text-xs font-bold text-acento">∗</span>
        <span className="font-medium">Todos</span>
        <span className="ml-auto text-xs tabular-nums text-tenue">{referentes.length}</span>
      </Link>
      {referentes.map((r) => (
        <Link key={r.id} href={enlace(r.id)} scroll={false} aria-current={activo === r.id ? "true" : undefined} className={fila(activo === r.id)}>
          {r.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.foto_url} alt="" className="size-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-panel-2 text-xs">{r.ig_username[0]?.toUpperCase()}</span>
          )}
          <span className="min-w-0">
            <span className="block truncate">@{r.ig_username}</span>
            <span className="block text-[11px] text-tenue">{numero(r.seguidores)} seguidores</span>
          </span>
        </Link>
      ))}
      <Link href="/referentes" className="mt-1 rounded-lg px-2.5 py-2 text-xs text-tenue hover:text-texto">
        + Agregar referente
      </Link>
    </aside>
  );
}
