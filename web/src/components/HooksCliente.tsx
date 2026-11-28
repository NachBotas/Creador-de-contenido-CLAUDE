"use client";

import { useMemo, useState, useTransition } from "react";
import { guardarHook, moverHook, quitarHook } from "@/app/acciones";

type RefMin = { id: string; usuario: string; carpeta_id: string | null };
type Candidato = { id: string; referente_id: string; fecha: string | null; ganador: boolean; outlier: number | null };

const PERIODOS = [
  [7, "Última semana"],
  [14, "Últimas 2 semanas"],
  [30, "Último mes"],
  [90, "Últimos 3 meses"],
  [180, "Últimos 6 meses"],
] as const;

// Formulario para pedir hooks: elegís cuentas, período y si solo ganadores; ves cuántos reels y cuánto cuesta.
export function FormPedirHooks({
  accion,
  referentes,
  carpetas,
  candidatos,
  precio,
}: {
  accion: (form: FormData) => Promise<void>;
  referentes: RefMin[];
  carpetas: { id: string; nombre: string }[];
  candidatos: Candidato[];
  precio: number;
}) {
  const [cuentas, setCuentas] = useState(() => new Set(referentes.map((r) => r.id)));
  const [dias, setDias] = useState(30);
  const [soloGanadores, setSoloGanadores] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const elegidos = useMemo(() => {
    const desde = Date.now() - dias * 86_400_000;
    return candidatos
      .filter((c) => cuentas.has(c.referente_id) && (!soloGanadores || c.ganador) && (!c.fecha || new Date(c.fecha).getTime() >= desde))
      .sort((a, b) => (b.outlier ?? 0) - (a.outlier ?? 0))
      .slice(0, 300);
  }, [candidatos, cuentas, dias, soloGanadores]);

  const alternar = (id: string) => {
    const n = new Set(cuentas);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setCuentas(n);
  };

  return (
    <form action={accion} onSubmit={() => setEnviando(true)} className="flex flex-col gap-4">
      {elegidos.map((c) => (
        <input key={c.id} type="hidden" name="reels" value={c.id} />
      ))}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-suave">
          <span>
            Cuentas · {cuentas.size} de {referentes.length}
          </span>
          <button type="button" onClick={() => setCuentas(new Set(referentes.map((r) => r.id)))} className="text-acento hover:underline">
            Todas
          </button>
          <button type="button" onClick={() => setCuentas(new Set())} className="hover:text-texto">
            Ninguna
          </button>
          {carpetas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCuentas(new Set(referentes.filter((r) => r.carpeta_id === c.id).map((r) => r.id)))}
              className="rounded-full border border-borde px-2 py-0.5 hover:text-texto"
            >
              📁 {c.nombre}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-borde bg-fondo p-3">
          {referentes.map((r) => {
            const on = cuentas.has(r.id);
            return (
              <label key={r.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${on ? "border-acento/50 bg-acento/10 text-texto" : "border-borde text-tenue"}`}>
                <input type="checkbox" checked={on} onChange={() => alternar(r.id)} className="sr-only" />
                <span aria-hidden="true" className={`size-1.5 rounded-full ${on ? "bg-acento" : "bg-tenue"}`} />@{r.usuario}
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-suave">
          De cuándo
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="h-10 rounded-md border border-borde bg-fondo px-2 text-sm">
            {PERIODOS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={soloGanadores} onChange={(e) => setSoloGanadores(e.target.checked)} className="size-4 accent-[var(--color-acento)]" />
          Solo ganadores (2x o más)
        </label>
      </div>
      <div className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs text-suave">
        <strong className="text-texto">{elegidos.length} reels</strong> sin hook todavía · costo:{" "}
        <strong className="text-texto">~US$ {(elegidos.length * precio).toFixed(2)}</strong>
        <span className="block text-tenue">Los que ya tienen hook no se vuelven a cobrar. Máximo 300 por pedido (los de mayor outlier primero).</span>
      </div>
      <button disabled={enviando || !elegidos.length} className="h-10 rounded-md bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc disabled:opacity-40">
        {enviando ? "Pidiendo…" : `Pedir hooks de ${elegidos.length} reels`}
      </button>
    </form>
  );
}

export function BotonGuardarHook({ id, guardado }: { id: string; guardado: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => iniciar(() => (guardado ? quitarHook(id) : guardarHook(id)))}
      className={`h-8 rounded-md px-2.5 text-xs font-medium disabled:opacity-50 ${guardado ? "bg-acento/15 text-acento" : "border border-borde text-suave hover:text-texto"}`}
    >
      {guardado ? "★ En mi lista" : "☆ Guardar en mi lista"}
    </button>
  );
}

export function SelectorCarpetaHook({ id, actual, carpetas }: { id: string; actual: string | null; carpetas: { id: string; nombre: string }[] }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <select
      aria-label="Carpeta"
      defaultValue={actual ?? ""}
      disabled={pendiente}
      onChange={(e) => iniciar(() => moverHook(id, e.target.value || null))}
      className="h-8 rounded-md border border-borde bg-fondo px-2 text-xs text-suave disabled:opacity-50"
    >
      <option value="">Sin carpeta</option>
      {carpetas.map((c) => (
        <option key={c.id} value={c.id}>
          📁 {c.nombre}
        </option>
      ))}
    </select>
  );
}

export function CopiarHooks({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(texto);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="h-9 rounded-md border border-borde px-3 text-sm text-suave hover:bg-panel-2 hover:text-texto"
    >
      {ok ? "¡Copiados!" : "Copiar todos"}
    </button>
  );
}
