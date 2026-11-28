import Link from "next/link";
import { listarCarpetas, ritmoReferentes, contar, contarHistorias, listarSecuencias, idsGuardados, leerFiltros, listarFormatos, listarPublicaciones, listarReferentes, obtenerPublicacion, type Filtros } from "@/lib/datos";
import type { Publicacion } from "@/lib/tipos";
import AutoEnviar from "./AutoEnviar";
import Encabezado, { Aviso, Vacio } from "./Encabezado";
import FormSync from "./FormSync";
import ProgresoSync from "./ProgresoSync";
import AlertasVirales from "./AlertasVirales";
import { sincronizar } from "@/app/acciones";
import Tarjeta from "./Tarjeta";
import PanelReferentes from "./PanelReferentes";
import DetallePublicacion from "./DetallePublicacion";
import { ControlModal } from "./Interactivos";
import GrillaHistorias from "./GrillaHistorias";
import { numero } from "@/lib/formato";

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

const COMENTARIOS_MIN = [
  ["0", "Cualquier cant. de comentarios"],
  ["50", "50+ comentarios"],
  ["100", "100+ comentarios"],
  ["500", "500+ comentarios"],
  ["1000", "1.000+ comentarios"],
  ["5000", "5.000+ comentarios"],
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
  porFormato: soloFormatos,
}: {
  sp: SP;
  tipo: Filtros["tipo"];
  titulo: string;
  bajada: string;
  porFormato: boolean;
}) {
  const f = leerFiltros(sp, tipo);
  const esHistorias = tipo === "todos" && sp.t === "historias";
  const porFormato = soloFormatos || f.tipo === "reel";
  const diasHist = f.dias > 0 ? f.dias : 365;
  // Referentes y carpetas primero: la carpeta define qué cuentas entran en el filtro.
  const [todosReferentes, carpetas] = await Promise.all([listarReferentes(), listarCarpetas()]);
  const carpetaActiva = carpetas.find((c) => c.id === f.carpeta);
  const referentes = carpetaActiva ? todosReferentes.filter((r) => r.carpeta_id === carpetaActiva.id) : todosReferentes;
  if (carpetaActiva) f.referentesCarpeta = referentes.map((r) => r.id);
  const idsHistorias = f.referente ? [f.referente] : carpetaActiva ? f.referentesCarpeta! : null;
  const [formatos, pubs, { porFormato: conteo, porTipo, ranking }, guardadas, cantHistorias, secuencias, ritmo] = await Promise.all([
    listarFormatos(),
    listarPublicaciones(f, f.vista === "tablero" ? 400 : Math.min(Math.max(Number(sp.limite) || 40, 40), 1000)),
    contar(f),
    idsGuardados(),
    tipo === "todos" ? contarHistorias(diasHist, f.referente, idsHistorias) : Promise.resolve(0),
    esHistorias ? listarSecuencias(diasHist, f.referente, idsHistorias) : Promise.resolve([]),
    tipo === "todos" ? ritmoReferentes() : Promise.resolve(new Map<string, number>()),
  ]);
  const refPorId = new Map(referentes.map((r) => [r.id, r]));
  const refActivo = f.referente ? refPorId.get(f.referente) : undefined;
  const hrefVer = (id: string) => `/p/${id}`;
  const hrefCerrar = enlace(sp, { ver: "" });

  const tabs = [
    { valor: "", nombre: "Todos" },
    ...formatos.map((x) => ({ valor: String(x.id), nombre: x.nombre })),
    { valor: "sin", nombre: "Sin formato" },
  ];

  return (
    <div className="mx-auto grid max-w-[1700px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8">
      <div className="max-lg:hidden">
        <PanelReferentes
          referentes={referentes}
          activo={f.referente}
          enlace={(id) => enlace(sp, { referente: id, ver: "", limite: "" })}
          carpetas={carpetas}
          carpetaActiva={f.carpeta}
          enlaceCarpeta={(id) => enlace(sp, { carpeta: id, referente: "", ver: "", limite: "" })}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
      {carpetas.length > 0 && (
        <nav aria-label="Carpetas" className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:hidden">
          {[{ id: "", nombre: "Todas las carpetas" }, ...carpetas].map((c) => (
            <Link
              key={c.id || "todas"}
              href={enlace(sp, { carpeta: c.id, referente: "", ver: "", limite: "" })}
              scroll={false}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm ${f.carpeta === c.id ? "border-acento/50 bg-acento/10" : "border-borde text-suave"}`}
            >
              {c.id ? `📁 ${c.nombre}` : c.nombre}
            </Link>
          ))}
        </nav>
      )}
      <nav aria-label="Referentes" className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:hidden">
        {[{ id: "", ig_username: "Todos" }, ...referentes].map((r) => (
          <Link
            key={r.id || "todos"}
            href={enlace(sp, { referente: r.id, ver: "" })}
            scroll={false}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm ${f.referente === r.id ? "border-acento/50 bg-acento/10" : "border-borde text-suave"}`}
          >
            {r.id ? `@${r.ig_username}` : "Todos"}
          </Link>
        ))}
      </nav>
      {refActivo ? (
        <header className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-panel p-4">
          {refActivo.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={refActivo.foto_url} alt="" className="size-11 rounded-full object-cover" />
          ) : (
            <span className="grid size-11 place-items-center rounded-full bg-panel-2">{refActivo.ig_username[0]?.toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">@{refActivo.ig_username}</h1>
            <p className="text-xs text-suave">{numero(refActivo.seguidores)} seguidores</p>
          </div>
          <a href={`https://www.instagram.com/${refActivo.ig_username}/`} target="_blank" rel="noreferrer" className="rounded-lg border border-borde px-3 py-1.5 text-xs text-suave hover:text-texto">
            Ver en Instagram ↗
          </a>
        </header>
      ) : null}
      <Encabezado titulo={refActivo ? "" : carpetaActiva ? `📁 ${carpetaActiva.nombre}` : titulo} bajada={refActivo ? "" : carpetaActiva ? `${referentes.length} referentes en esta carpeta` : bajada}>
        {porFormato && !esHistorias && (
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

      <Aviso msg={typeof sp.msg === "string" ? sp.msg : undefined} error={typeof sp.error === "string" ? sp.error : undefined} />
      {tipo === "todos" && <ProgresoSync />}
      {tipo === "todos" && <AlertasVirales />}

      {tipo === "todos" && referentes.length > 0 && (
        <details className="group rounded-xl border border-borde bg-panel">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 24 24" className="size-4 text-acento" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M21 4v5h-5M3 20v-5h5" />
            </svg>
            Sincronizar ahora
            <span className="font-normal text-tenue">· elegí cuentas y qué traer</span>
            <span className="ml-auto text-xs text-tenue group-open:hidden">Abrir</span>
            <span className="ml-auto hidden text-xs text-tenue group-open:inline">Cerrar</span>
          </summary>
          <div className="border-t border-borde p-4">
            <FormSync
              accion={sincronizar}
              referentes={referentes.map((r) => ({ id: r.id, usuario: r.ig_username, contenido: r.contenido_activo, historias: r.historias_activo, ritmo: ritmo.get(r.id) ?? 0 }))}
              modo="ahora"
              inicial={{ feed: true, historias: true, dias: 7 }}
              cuentaInicial={f.referente}
              volverA="contenido"
            />
          </div>
        </details>
      )}

      {tipo === "todos" && (
        <div role="tablist" aria-label="Tipo" className="flex flex-wrap gap-1">
          {(
            [
              ["", "Todos", "todos"],
              ["reel", "Reels", "reel"],
              ["carrusel", "Carruseles", "carrusel"],
            ] as const
          ).map(([v, nombre, k]) => {
            const on = !esHistorias && (f.tipo === "todos" ? "" : f.tipo) === v;
            return (
              <Link
                key={k}
                role="tab"
                aria-selected={on}
                scroll={false}
                href={enlace(sp, { t: v, ver: "", formato: "" })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${on ? "border-acento/50 bg-acento/10 text-texto" : "border-borde text-suave hover:text-texto"}`}
              >
                {nombre} <span className="ml-1 text-xs tabular-nums text-tenue">{porTipo.get(k) ?? 0}</span>
              </Link>
            );
          })}
          <Link
            role="tab"
            aria-selected={esHistorias}
            scroll={false}
            href={enlace(sp, { t: "historias", ver: "", formato: "" })}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${esHistorias ? "border-acento/50 bg-acento/10 text-texto" : "border-borde text-suave hover:text-texto"}`}
          >
            Historias <span className="ml-1 text-xs tabular-nums text-tenue">{cantHistorias}</span>
          </Link>
        </div>
      )}

      {esHistorias ? (
        <>
          <div role="tablist" aria-label="Período" className="inline-flex w-fit rounded-lg bg-panel p-1 text-xs">
            {(
              [
                ["7", "7 días"],
                ["30", "30 días"],
                ["90", "3 meses"],
              ] as const
            ).map(([d, nombre]) => (
              <Link
                key={d}
                role="tab"
                aria-selected={String(diasHist) === d}
                scroll={false}
                href={enlace(sp, { dias: d })}
                className={`rounded-md px-3 py-1.5 font-medium ${String(diasHist) === d ? "bg-panel-2 text-texto" : "text-suave hover:text-texto"}`}
              >
                {nombre}
              </Link>
            ))}
          </div>
          <GrillaHistorias secuencias={secuencias} refPorId={refPorId} />
        </>
      ) : (
        <>
      {porFormato && ranking.some((r) => r.clave !== "sin") && (
        <section aria-label="Formatos que más funcionan" className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">
            Qué formato funciona mejor <span className="font-normal text-tenue">· con los filtros actuales</span>
          </h2>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {ranking
              .filter((r) => r.clave !== "sin")
              .map((r, i) => {
                const nombre = formatos.find((x) => String(x.id) === r.clave)?.nombre ?? "—";
                return (
                  <Link
                    key={r.clave}
                    href={enlace(sp, { formato: r.clave, ver: "" })}
                    scroll={false}
                    className={`w-48 shrink-0 rounded-xl border p-3 transition hover:border-suave/40 ${i === 0 ? "border-ganador/50 bg-ganador/10" : "border-borde bg-panel"}`}
                  >
                    <p className="flex items-center justify-between text-sm font-medium">
                      {nombre} {i === 0 && <span className="text-[10px] font-semibold text-ganador">TOP</span>}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{r.outlierMediano !== null ? `${r.outlierMediano.toFixed(1)}x` : "—"}</p>
                    <p className="text-[11px] text-tenue">outlier mediano</p>
                    <p className="mt-2 text-xs text-suave">
                      {r.piezas} reels · {Math.round((r.ganadores / r.piezas) * 100)}% ganadores · {r.comentariosPromedio} com. prom.
                    </p>
                  </Link>
                );
              })}
          </div>
        </section>
      )}

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
        {f.carpeta && <input type="hidden" name="carpeta" value={f.carpeta} />}
        {tipo === "todos" && f.tipo !== "todos" && <input type="hidden" name="t" value={f.tipo} />}
        {f.referente && <input type="hidden" name="referente" value={f.referente} />}
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
        <Select name="mincom" valor={String(f.minCom)} opciones={COMENTARIOS_MIN} etiqueta="Comentarios mínimos" />
        <Check name="ganadores" on={f.ganadores} texto="Solo ganadores" />
        <Check name="cta" on={f.cta} texto="Piden comentar palabra" />
        <a
          href={`/api/exportar${enlace(sp, { ver: "", vista_de: f.tipo })}`}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-md border border-borde px-3 text-sm text-suave hover:bg-panel-2 hover:text-texto"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Exportar a Excel
        </a>
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
        <Tablero pubs={pubs} tabs={tabs.slice(1)} refPorId={refPorId} formatos={formatos} hrefVer={hrefVer} guardadas={guardadas} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {pubs.map((p) => (
              <Tarjeta key={p.id} p={p} href={hrefVer(p.id)} guardada={guardadas.has(p.id)} referente={refPorId.get(p.referente_id)} formatos={formatos} mostrarFormato={porFormato} />
            ))}
          </div>
          {(() => {
            const total = porFormato ? (conteo.get(f.formato) ?? pubs.length) : (porTipo.get(f.tipo === "todos" ? "todos" : f.tipo) ?? pubs.length);
            const hayMas = pubs.length < total;
            return (
              <div className="flex flex-col items-center gap-2 pb-6 pt-2">
                <p className="text-xs text-tenue">
                  Mostrando {pubs.length} de {total}
                </p>
                {hayMas && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link
                      href={enlace(sp, { limite: String(pubs.length + 40), ver: "" })}
                      scroll={false}
                      className="h-10 rounded-lg border border-borde px-5 text-sm leading-10 hover:bg-panel"
                    >
                      Ver más (40 más)
                    </Link>
                    <Link
                      href={enlace(sp, { limite: String(Math.min(total, 1000)), ver: "" })}
                      scroll={false}
                      className="h-10 rounded-lg px-4 text-sm leading-10 text-suave hover:text-texto"
                    >
                      Mostrar todas ({total})
                    </Link>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
        </>
      )}
      </div>

    </div>
  );
}

function Tablero({
  pubs,
  tabs,
  refPorId,
  formatos,
  hrefVer,
  guardadas,
}: {
  hrefVer: (id: string) => string;
  guardadas: Set<string>;
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
              <Tarjeta key={p.id} p={p} href={hrefVer(p.id)} guardada={guardadas.has(p.id)} referente={refPorId.get(p.referente_id)} formatos={formatos} mostrarFormato />
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
