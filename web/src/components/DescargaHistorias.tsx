"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { downloadZip } from "client-zip";
import { borrarHistoriasDeLaNube, prepararDescargaHistorias } from "@/app/acciones";

export type ArchivoHistoria = { id: string; url: string | null; nombre: string; borrada: boolean };

// Barra con Seleccionar todo / Descargar (.zip) / Borrar de la nube, para una lista de historias.
export function BarraHistorias({
  elegidas,
  todas,
  setElegidas,
}: {
  elegidas: ArchivoHistoria[];
  todas: ArchivoHistoria[];
  setElegidas: (ids: Set<string>) => void;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const conArchivo = elegidas.filter((h) => !h.borrada && h.url);
  const disponibles = todas.filter((h) => !h.borrada && h.url);

  async function descargar() {
    if (!conArchivo.length) return;
    setOcupado(true);
    try {
      const corsOk = await prepararDescargaHistorias();
      const archivos: { name: string; input: Response }[] = [];
      let n = 0;
      for (const h of conArchivo) {
        setEstado(`Bajando ${++n} de ${conArchivo.length}…`);
        let res: Response | null = null;
        if (corsOk) res = await fetch(h.url!).catch(() => null);
        if (!res || !res.ok) res = await fetch(`/api/historias/archivo/${h.id}`).catch(() => null);
        if (res?.ok) archivos.push({ name: h.nombre, input: res });
      }
      setEstado("Armando el .zip…");
      const blob = await downloadZip(archivos).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `historias-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setEstado(`Descargadas ${archivos.length} historias.`);
      if (archivos.length && confirm(`Se descargaron ${archivos.length} historias. ¿Las borro de la nube para liberar espacio?\n\nRevisá antes que el .zip se haya guardado bien.`)) {
        await borrar(true);
      }
    } catch (e) {
      setEstado(`Error: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function borrar(yaConfirmado = false) {
    if (!conArchivo.length) return;
    if (!yaConfirmado && !confirm(`¿Borrar de la nube ${conArchivo.length} historias? No se puede deshacer: descargalas antes si las querés guardar.`)) return;
    setOcupado(true);
    setEstado("Borrando…");
    try {
      setEstado(await borrarHistoriasDeLaNube(conArchivo.map((h) => h.id)));
      setElegidas(new Set());
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-borde bg-panel/95 p-3 backdrop-blur">
      <span className="text-sm">
        <strong className="tabular-nums">{conArchivo.length}</strong> <span className="text-suave">de {disponibles.length} seleccionadas</span>
      </span>
      <button type="button" onClick={() => setElegidas(new Set(disponibles.map((h) => h.id)))} className="text-xs text-acento hover:underline">
        Seleccionar todas
      </button>
      <button type="button" onClick={() => setElegidas(new Set())} className="text-xs text-suave hover:text-texto">
        Ninguna
      </button>
      {estado && <span className="text-xs text-suave">{estado}</span>}
      <div className="ml-auto flex gap-2">
        <button
          type="button"
          disabled={ocupado || !conArchivo.length}
          onClick={descargar}
          className="h-9 rounded-md bg-acento px-3 text-sm font-semibold text-black hover:bg-acento-osc disabled:opacity-40"
        >
          Descargar (.zip)
        </button>
        <button
          type="button"
          disabled={ocupado || !conArchivo.length}
          onClick={() => borrar()}
          className="h-9 rounded-md border border-peligro/40 px-3 text-sm text-peligro hover:bg-peligro/10 disabled:opacity-40"
        >
          Borrar de la nube
        </button>
      </div>
    </div>
  );
}

export function Casilla({ marcada, onChange, etiqueta }: { marcada: boolean; onChange: () => void; etiqueta: string }) {
  return (
    <label
      className={`absolute left-2 top-2 z-10 grid size-6 cursor-pointer place-items-center rounded-md border-2 ${marcada ? "border-acento bg-acento text-black" : "border-white/80 bg-black/50"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <input type="checkbox" checked={marcada} onChange={onChange} aria-label={etiqueta} className="sr-only" />
      {marcada && (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="m5 12 5 5L20 7" />
        </svg>
      )}
    </label>
  );
}
