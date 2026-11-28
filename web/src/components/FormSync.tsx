"use client";

import { useState } from "react";

const PRECIO_POST = 0.0027; // por publicación (Apify)
const PRECIO_PERFIL = 0.0027;
const HISTORIAS_X_CUENTA = 8; // promedio estimado por día
const PRECIO_HISTORIA = 0.0017;

const PERIODOS = [
  [7, "Última semana"],
  [14, "Últimas 2 semanas"],
  [21, "Últimas 3 semanas"],
  [28, "Últimas 4 semanas"],
  [30, "Último mes"],
  [90, "Últimos 3 meses"],
  [180, "Últimos 6 meses"],
] as const;

const FRECUENCIAS = [
  ["nunca", "No, lo hago yo a mano"],
  ["semanal", "Semanal: cada lunes, últimos 7 días"],
  ["diaria", "Diaria: cada mañana, últimos 2 días"],
] as const;

export type Frecuencia = (typeof FRECUENCIAS)[number][0];
type Ref = { id: string; usuario: string; contenido: boolean; historias: boolean; ritmo: number };

export default function FormSync({
  accion,
  referentes,
  modo,
  inicial,
  cuentaInicial = "",
  volverA,
}: {
  accion: (form: FormData) => Promise<void>;
  referentes: Ref[];
  modo: "ahora" | "diaria";
  inicial: { feed: boolean; historias: boolean; dias: number; frecuencia?: Frecuencia };
  cuentaInicial?: string;
  volverA?: "contenido";
}) {
  const [feed, setFeed] = useState(inicial.feed);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(inicial.frecuencia ?? (inicial.feed ? "semanal" : "nunca"));
  const [historias, setHistorias] = useState(inicial.historias);
  const [dias, setDias] = useState(PERIODOS.some(([d]) => d === inicial.dias) ? inicial.dias : 7);
  const [enviando, setEnviando] = useState(false);
  const [idsFeed, setIdsFeed] = useState(() => new Set(referentes.filter((r) => r.contenido).map((r) => r.id)));
  const [idsHist, setIdsHist] = useState(() => new Set(referentes.filter((r) => r.historias).map((r) => r.id)));
  const [idsAhora, setIdsAhora] = useState(() => new Set(cuentaInicial ? [cuentaInicial] : referentes.map((r) => r.id)));
  const alternar = (set: Set<string>, fijar: (s: Set<string>) => void, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    fijar(n);
  };

  // Estimación: lo que suele publicar cada cuenta (últimos 30 días) × los días pedidos.
  const conFeed = modo === "ahora" ? (feed ? idsAhora : new Set<string>()) : frecuencia === "nunca" ? new Set<string>() : idsFeed;
  const conHist = historias ? (modo === "ahora" ? idsAhora : idsHist) : new Set<string>();
  const diasFeed = modo === "ahora" ? dias : frecuencia === "semanal" ? 7 : 2;
  const postsEstimados = referentes.filter((r) => conFeed.has(r.id)).reduce((s, r) => s + Math.max(r.ritmo, 0.5) * diasFeed, 0);
  const costoFeed = postsEstimados * PRECIO_POST + conFeed.size * PRECIO_PERFIL;
  const costoHist = conHist.size * HISTORIAS_X_CUENTA * PRECIO_HISTORIA;
  const usd = (n: number) => `US$ ${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
  const costoMes =
    modo === "diaria" ? costoHist * 30 + (frecuencia === "diaria" ? costoFeed * 30 : frecuencia === "semanal" ? costoFeed * 4.3 : 0) : 0;
  const sel = "h-10 rounded-md border border-borde bg-fondo px-2 text-sm";

  return (
    <form action={accion} onSubmit={() => setEnviando(true)} className="flex flex-col gap-4">
      {volverA && <input type="hidden" name="volver" value={volverA} />}
      {modo === "ahora" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-suave">
            <span>
              Cuentas · {idsAhora.size} de {referentes.length}
            </span>
            <span className="flex gap-3">
              <button type="button" onClick={() => setIdsAhora(new Set(referentes.map((r) => r.id)))} className="text-acento hover:underline">
                Todas
              </button>
              <button type="button" onClick={() => setIdsAhora(new Set())} className="hover:text-texto">
                Ninguna
              </button>
            </span>
          </div>
          <Cuentas nombre="ids" referentes={referentes} elegidas={idsAhora} alternar={(id) => alternar(idsAhora, setIdsAhora, id)} sinMargen />
        </div>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs text-suave">Qué traer</legend>

        {modo === "ahora" ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="feed" value="1" checked={feed} onChange={(e) => setFeed(e.target.checked)} className="size-4 accent-[var(--color-acento)]" />
              Reels y carruseles
            </label>
            {feed && (
              <label className="ml-6 flex flex-col gap-1 text-xs text-suave">
                De cuándo
                <select name="dias" value={dias} onChange={(e) => setDias(Number(e.target.value))} className={`${sel} w-fit`}>
                  {PERIODOS.map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-tenue">Trae todo lo publicado en ese período, sin límite de cantidad.</span>
              </label>
            )}
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Reels y carruseles automáticos
              <select name="frecuencia" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)} className={`${sel} w-fit`}>
                {FRECUENCIAS.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {frecuencia !== "nunca" && (
              <Cuentas nombre="feed_ids" referentes={referentes} elegidas={idsFeed} alternar={(id) => alternar(idsFeed, setIdsFeed, id)} />
            )}
          </>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="historias" value="1" checked={historias} onChange={(e) => setHistorias(e.target.checked)} className="size-4 accent-[var(--color-acento)]" />
          Historias {modo === "diaria" ? "todos los días" : "(las activas de las últimas 24 h)"}
        </label>
        {historias && modo === "diaria" && (
          <Cuentas nombre="hist_ids" referentes={referentes} elegidas={idsHist} alternar={(id) => alternar(idsHist, setIdsHist, id)} />
        )}
      </fieldset>

      <div className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs text-suave">
        {modo === "ahora" ? (
          <>
            Costo estimado en Apify: <strong className="text-texto">~{usd(costoFeed + costoHist)}</strong>
            {conFeed.size > 0 && <span className="block text-tenue">Calculado con lo que publica cada cuenta (~{Math.round(postsEstimados)} publicaciones).</span>}
          </>
        ) : (
          <>
            Costo estimado por mes: <strong className="text-texto">~{usd(costoMes)}</strong>
            <span className="block text-tenue">Tu plan gratis de Apify trae US$ 5 por mes.</span>
          </>
        )}
      </div>

      <button
        disabled={enviando || (modo === "ahora" && ((!feed && !historias) || idsAhora.size === 0))}
        className="h-10 rounded-md bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc disabled:opacity-50"
      >
        {enviando ? "Un momento…" : modo === "ahora" ? "Sincronizar ahora" : "Guardar sincronización automática"}
      </button>
    </form>
  );
}

function Cuentas({
  nombre,
  referentes,
  elegidas,
  alternar,
  sinMargen,
}: {
  nombre: string;
  referentes: Ref[];
  elegidas: Set<string>;
  alternar: (id: string) => void;
  sinMargen?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-lg border border-borde bg-fondo p-3 ${sinMargen ? "" : "ml-6"}`}>
      {!sinMargen && (
        <p className="text-xs text-suave">
          De qué cuentas · {elegidas.size} de {referentes.length}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {referentes.map((r) => {
          const on = elegidas.has(r.id);
          return (
            <label
              key={r.id}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-acento/50 bg-acento/10 text-texto" : "border-borde text-tenue"}`}
            >
              <input type="checkbox" name={nombre} value={r.id} checked={on} onChange={() => alternar(r.id)} className="sr-only" />
              <span aria-hidden="true" className={`size-1.5 rounded-full ${on ? "bg-acento" : "bg-tenue"}`} />@{r.usuario}
            </label>
          );
        })}
      </div>
    </div>
  );
}
