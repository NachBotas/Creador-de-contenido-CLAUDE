"use client";

import { useState } from "react";

const PRECIO_POST = 0.0027; // por publicación (Apify, plan Free)
const PRECIO_PERFIL = 0.0027;
const HISTORIAS_X_CUENTA = 8; // promedio estimado por día
const PRECIO_HISTORIA = 0.0017;

const PERIODOS = [
  [7, "Última semana"],
  [14, "Últimas 2 semanas"],
  [21, "Últimas 3 semanas"],
  [30, "Último mes"],
  [90, "Últimos 3 meses"],
  [0, "Sin límite de fecha"],
] as const;
const MAXIMOS = [5, 8, 10, 20, 30, 50, 100];

type Ref = { id: string; usuario: string; contenido: boolean; historias: boolean };

export default function FormSync({
  accion,
  referentes,
  modo,
  inicial,
  cuentaInicial = "",
}: {
  accion: (form: FormData) => Promise<void>;
  referentes: Ref[];
  modo: "ahora" | "diaria";
  inicial: { feed: boolean; historias: boolean; dias: number; maximo: number };
  cuentaInicial?: string;
}) {
  const [feed, setFeed] = useState(inicial.feed);
  const [historias, setHistorias] = useState(inicial.historias);
  const [dias, setDias] = useState(inicial.dias);
  const [maximo, setMaximo] = useState(inicial.maximo);
  const [cuenta, setCuenta] = useState(cuentaInicial);
  const [enviando, setEnviando] = useState(false);

  const nFeed = cuenta ? 1 : referentes.filter((r) => r.contenido).length;
  const nHist = cuenta ? 1 : referentes.filter((r) => r.historias).length;
  const costoFeed = feed ? nFeed * (maximo * PRECIO_POST + PRECIO_PERFIL) : 0;
  const costoHist = historias ? nHist * HISTORIAS_X_CUENTA * PRECIO_HISTORIA : 0;
  const total = costoFeed + costoHist;
  const usd = (n: number) => `US$ ${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
  const sel = "h-10 rounded-md border border-borde bg-fondo px-2 text-sm";

  return (
    <form action={accion} onSubmit={() => setEnviando(true)} className="flex flex-col gap-4">
      {modo === "ahora" && (
        <label className="flex flex-col gap-1 text-xs text-suave">
          Cuentas
          <select name="id" value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={sel}>
            <option value="">Todas (según sus interruptores)</option>
            {referentes.map((r) => (
              <option key={r.id} value={r.id}>
                @{r.usuario}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs text-suave">Qué traer</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="feed" value="1" checked={feed} onChange={(e) => setFeed(e.target.checked)} className="size-4 accent-[var(--color-acento)]" />
          Feed: reels y carruseles
        </label>
        {feed && (
          <div className="ml-6 flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-xs text-suave">
              Hasta cuándo hacia atrás
              <select name="dias" value={dias} onChange={(e) => setDias(Number(e.target.value))} className={sel}>
                {PERIODOS.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-suave">
              Máximo por cuenta
              <select name="maximo" value={maximo} onChange={(e) => setMaximo(Number(e.target.value))} className={sel}>
                {MAXIMOS.map((m) => (
                  <option key={m} value={m}>
                    {m} publicaciones
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="historias" value="1" checked={historias} onChange={(e) => setHistorias(e.target.checked)} className="size-4 accent-[var(--color-acento)]" />
          Historias (las activas de las últimas 24 h)
        </label>
      </fieldset>

      <div className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs text-suave">
        {modo === "ahora" ? (
          <>
            Costo máximo en Apify: <strong className="text-texto">{usd(total)}</strong>
          </>
        ) : (
          <>
            Por día: <strong className="text-texto">{usd(total)}</strong> · por mes: <strong className="text-texto">~{usd(total * 30)}</strong>
            <span className="block text-tenue">Tu plan gratis de Apify trae US$ 5 por mes.</span>
          </>
        )}
        {feed && <span className="block text-tenue">Se cobra solo lo que se trae: si hay menos publicaciones en ese período, cuesta menos.</span>}
      </div>

      <button
        disabled={enviando || (!feed && !historias)}
        className="h-10 rounded-md bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc disabled:opacity-50"
      >
        {enviando ? "Un momento…" : modo === "ahora" ? "Sincronizar ahora" : "Guardar sincronización automática"}
      </button>
    </form>
  );
}
