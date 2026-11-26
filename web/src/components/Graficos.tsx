// Gráficos simples en SVG, dibujados en el servidor.

export function Linea({ puntos, alto = 180, etiqueta }: { puntos: { x: string; y: number }[]; alto?: number; etiqueta: string }) {
  if (puntos.length < 2) return null;
  const ancho = 600;
  const pad = { t: 10, r: 8, b: 22, l: 44 };
  const ys = puntos.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const rango = max - min || 1;
  const x = (i: number) => pad.l + (i / (puntos.length - 1)) * (ancho - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / rango) * (alto - pad.t - pad.b);
  const d = puntos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const area = `${d} L${x(puntos.length - 1)},${alto - pad.b} L${x(0)},${alto - pad.b} Z`;
  const marcas = [min, min + rango / 2, max];
  const cadaX = Math.max(1, Math.ceil(puntos.length / 6));
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-label={etiqueta}>
      {marcas.map((m, i) => (
        <g key={i}>
          <line x1={pad.l} x2={ancho - pad.r} y1={y(m)} y2={y(m)} stroke="var(--color-borde)" strokeDasharray="3 4" />
          <text x={pad.l - 6} y={y(m) + 4} textAnchor="end" fontSize="10" fill="var(--color-tenue)">
            {Math.round(m).toLocaleString("es-AR")}
          </text>
        </g>
      ))}
      <path d={area} fill="var(--color-acento)" opacity="0.08" />
      <path d={d} fill="none" stroke="var(--color-acento)" strokeWidth="2" strokeLinejoin="round" />
      {puntos.map((p, i) =>
        i % cadaX === 0 || i === puntos.length - 1 ? (
          <text key={p.x} x={x(i)} y={alto - 6} textAnchor="middle" fontSize="10" fill="var(--color-tenue)">
            {p.x.slice(8, 10)}/{p.x.slice(5, 7)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function Barras({ filas, total, max = 15 }: { filas: { clave: string; valor: number }[]; total?: number; max?: number }) {
  const tope = Math.max(...filas.map((f) => f.valor), 1);
  const suma = total ?? filas.reduce((a, f) => a + f.valor, 0);
  return (
    <ul className="flex flex-col gap-2.5">
      {filas.slice(0, max).map((f) => (
        <li key={f.clave} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate">{f.clave}</span>
            <span className="shrink-0 tabular-nums text-suave">
              {f.valor.toLocaleString("es-AR")} <span className="text-tenue">· {suma ? Math.round((f.valor / suma) * 100) : 0}%</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-acento" style={{ width: `${(f.valor / tope) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({ titulo, valor, nota, positivo }: { titulo: string; valor: string; nota?: string; positivo?: boolean }) {
  return (
    <div className="rounded-xl border border-borde bg-panel p-4">
      <p className="text-xs text-suave">{titulo}</p>
      <p className={`mt-1 break-words font-semibold tabular-nums ${valor.length > 14 ? "text-base" : "text-2xl"} ${positivo ? "text-acento" : ""}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-[11px] text-tenue">{nota}</p>}
    </div>
  );
}

export function Tarjeta({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borde bg-panel p-4 ${className}`}>
      <h3 className="mb-3 text-sm font-medium">{titulo}</h3>
      {children}
    </section>
  );
}
