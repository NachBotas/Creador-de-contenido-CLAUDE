import Link from "next/link";
import { contarPorFormato, leerFiltros, listarFormatos, listarPublicaciones, listarReferentes, type Filtros } from "@/lib/datos";
import type { Publicacion } from "@/lib/tipos";
import AutoEnviar from "./AutoEnviar";
import Encabezado, { Vacio } from "./Encabezado";
import Tarjeta from "./Tarjeta";

type SP = Record<string, string | string[] | undefined>;

const ORDENES = [
  ["outlier", "Más outlier"],
  ["recientes", "Más recientes"],
  ["comentarios", "Más comentarios"],
  ["tasa", "Mayor % de comentarios"],
  ["outlier_com", "Comentarios sobre su promedio"],
  ["vistas", "Más vistas / likes"],
] as const;

const PERIODOS = [
  ["7", "Últimos 7 días"],
  ["30", "Últimos 30 días"],
  ["90", "Últimos 3 meses"],
  ["180", "Últimos 6 meses"],
  ["0", "Todo"],
] as const;

const MINIMOS = [
  ["0", "Cualquier outlier"],
  ["1.5", "1.5x o más"],
  ["2", "2x o más"],
  ["3", "3x o más"],
  ["5", "5x o más"],
  ["10", "10x o más"],
] as const;

function enlace(sp: SP, cambios: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
  for (const [k, v] of Object.entries(cambios)) (v ? p.set(k, v) : p.delete(k));
  const s = p.toString();
  return s ? `?${s}` : "?";
}

export default async function VistaPublicaciones({
  sp,
  tipo,
  titulo,
  bajada,
  porFormato,
}: {
  sp: SP;
  tipo: Filtros["tipo"];
  titulo: string;
  bajada: string;
  porFormato: boolean;
}) {
  const f = leerFiltros(sp, tipo);
  const [formatos, referentes, pubs, conteo] = await Promise.all([
    listarFormatos(),
    listarReferentes(),
    listarPublicaciones(f, f.vista === "tablero" ? 400 : 120),
    porFormato ? contarPorFormato(f) : Promise.resolve(new Map<string, number>()),
  ]);
  const refPorId = new Map(referentes.map((r) => [r.id, r]));

  const tabs = [
    { valor: "", nombre: "Todos" },
    ...formatos.map((x) => ({ valor: String(x.id), nombre: x.nombre })),
    { valor: "sin", nombre: "Sin formato" },
  ];

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado titulo={titulo} bajada={bajada}>
        {porFormato && (
          <div role="tablist" aria-label="Vista" className="inline-flex rounded-lg bg-panel p-1 text-xs">
            {(["grilla", "tablero"] as const).map((v) => (
              <Link
                key={v}
                role="tab"
                aria-selected={f.vista === v}
                href={enlace(sp, { vista: v === "grilla" ? "" : v })}
                className={`rounded-md px-3 py-1.5 font-medium capitalize ${f.vista === v ? "bg-panel-2 text-texto" : "text-suave hover:text-texto"}`}
              >
                {v}
              </Link>
            ))}
          </div>
        )}
      </Encabezado>

      {porFormato && f.vista === "grilla" && (
        <div role="tablist" aria-label="Formatos" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {tabs.map((t) => {
            const on = f.formato === t.valor;
            return (
              <Link
                key={t.valor || "todos"}
                role="tab"
                aria-selected={on}
                href={enlace(sp, { formato: t.valor })}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm transition ${
                  on ? "border-acento/50 bg-acento/10 text-texto" : "border-borde text-suave hover:text-texto"
                }`}
              >
                {t.nombre} <span className="ml-1 text-xs tabular-nums text-tenue">{conteo.get(t.valor) ?? 0}</span>
              </Link>
            );
          })}
        </div>
      )}

      <AutoEnviar className="flex flex-wrap items-center gap-2 rounded-xl border border-borde bg-panel p-3">
        {f.formato && <input type="hidden" name="formato" value={f.formato} />}
        {f.vista === "tablero" && <input type="hidden" name="vista" value="tablero" />}
        <input
          type="search"
          name="q"
          defaultValue={f.q}
          placeholder="Buscar en el texto…"
          aria-label="Buscar en el texto"
          className="h-9 min-w-0 flex-1 basis-48 rounded-md border border-borde bg-fondo px-3 text-sm outline-none focus:border-acento"
        />
        <Select name="orden" valor={f.orden} opciones={ORDENES} etiqueta="Ordenar por" />
        <Select name="dias" valor={String(f.dias)} opciones={PERIODOS} etiqueta="Período" />
        <Select name="min" valor={String(f.min)} opciones={MINIMOS} etiqueta="Outlier mínimo" />
        <Select
          name="referente"
          valor={f.referente}
          opciones={[["", "Todos los referentes"], ...referentes.map((r) => [r.id, `@${r.ig_username}`] as const)]}
          etiqueta="Referente"
        />
        <Check name="ganadores" on={f.ganadores} texto="Solo ganadores" />
        <Check name="cta" on={f.cta} texto="Piden comentar palabra" />
        <noscript>
          <button className="h-9 rounded-md bg-acento px-3 text-sm font-medium text-black">Aplicar</button>
        </noscript>
      </AutoEnviar>

      {pubs.length === 0 ? (
        <Vacio
          titulo={referentes.length ? "No hay resultados con estos filtros" : "Todavía no hay contenido"}
          texto={
            referentes.length
              ? "Probá ampliar el período o bajar el outlier mínimo."
              : "Agregá tus primeros referentes y la app va a traer sus reels, carruseles e historias."
          }
        >
          {!referentes.length && (
            <Link href="/referentes" className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-black">
              Agregar referentes
            </Link>
          )}
        </Vacio>
      ) : f.vista === "tablero" && porFormato ? (
        <Tablero pubs={pubs} tabs={tabs.slice(1)} refPorId={refPorId} formatos={formatos} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {pubs.map((p) => (
            <Tarjeta key={p.id} p={p} referente={refPorId.get(p.referente_id)} formatos={formatos} mostrarFormato={porFormato} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tablero({
  pubs,
  tabs,
  refPorId,
  formatos,
}: {
  pubs: Publicacion[];
  tabs: { valor: string; nombre: string }[];
  refPorId: Map<string, import("@/lib/tipos").Referente>;
  formatos: import("@/lib/tipos").Formato[];
}) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {tabs.map((t) => {
        const col = pubs.filter((p) => (t.valor === "sin" ? p.formato_id === null : String(p.formato_id) === t.valor)).slice(0, 30);
        return (
          <section key={t.valor} aria-label={t.nombre} className="flex w-64 shrink-0 flex-col gap-3 rounded-xl bg-panel/50 p-2">
            <h2 className="flex items-center justify-between px-1 pt-1 text-sm font-medium">
              {t.nombre} <span className="text-xs tabular-nums text-tenue">{col.length}</span>
            </h2>
            {col.map((p) => (
              <Tarjeta key={p.id} p={p} referente={refPorId.get(p.referente_id)} formatos={formatos} mostrarFormato />
            ))}
            {!col.length && <p className="px-1 pb-2 text-xs text-tenue">Nada todavía.</p>}
          </section>
        );
      })}
    </div>
  );
}

function Select({ name, valor, opciones, etiqueta }: { name: string; valor: string; opciones: readonly (readonly [string, string])[]; etiqueta: string }) {
  return (
    <select
      name={name}
      defaultValue={valor}
      aria-label={etiqueta}
      title={etiqueta}
      className="h-9 rounded-md border border-borde bg-fondo px-2 text-sm text-suave hover:text-texto"
    >
      {opciones.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}

function Check({ name, on, texto }: { name: string; on: boolean; texto: string }) {
  return (
    <label className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${on ? "border-acento/50 text-texto" : "border-borde text-suave"}`}>
      <input type="checkbox" name={name} value="1" defaultChecked={on} className="accent-[var(--color-acento)]" />
      {texto}
    </label>
  );
}
