import { TIPOS, type Paso } from "@/lib/etiquetas";

export function Chip({ tipo, texto }: { tipo: keyof typeof TIPOS; texto?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ borderColor: `${TIPOS[tipo].color}66`, color: TIPOS[tipo].color, background: `${TIPOS[tipo].color}14` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: TIPOS[tipo].color }} aria-hidden="true" />
      {texto ?? TIPOS[tipo].nombre}
    </span>
  );
}

const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

// Línea de tiempo vertical con cada etiqueta en orden.
export default function Recorrido({ pasos, cierre }: { pasos: Paso[]; cierre: Date | null }) {
  const items: ({ k: "paso"; p: Paso } | { k: "cierre"; f: Date })[] = pasos.map((p) => ({ k: "paso" as const, p }));
  if (cierre) {
    const i = items.findIndex((x) => x.k === "paso" && (!x.p.fecha || x.p.fecha.getTime() > cierre.getTime()));
    items.splice(i === -1 ? items.length : i, 0, { k: "cierre", f: cierre });
  }
  if (!items.length) return <p className="text-sm text-suave">Esta persona no tiene etiquetas en ManyChat.</p>;
  return (
    <ol className="relative flex flex-col gap-4 border-l border-borde pl-6">
      {items.map((it, i) =>
        it.k === "cierre" ? (
          <li key={`c${i}`} className="relative">
            <span className="absolute -left-[31px] top-0.5 grid size-4 place-items-center rounded-full bg-ganador text-[9px] text-black">★</span>
            <p className="text-sm font-semibold text-ganador">Cerró como cliente</p>
            <p className="text-xs text-tenue">{fmt(it.f)}</p>
          </li>
        ) : (
          <li key={`p${i}`} className="relative">
            <span className="absolute -left-[29px] top-1 size-3 rounded-full ring-4 ring-fondo" style={{ background: TIPOS[it.p.tipo].color }} aria-hidden="true" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{it.p.nombre}</span>
              <Chip tipo={it.p.tipo} />
            </div>
            <p className="text-xs text-tenue">{it.p.fecha ? fmt(it.p.fecha) : "sin fecha en el nombre"}</p>
          </li>
        ),
      )}
    </ol>
  );
}
