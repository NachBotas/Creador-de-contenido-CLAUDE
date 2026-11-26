export default function Encabezado({ titulo, bajada, children }: { titulo: string; bajada: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-suave">{bajada}</p>
      </div>
      {children}
    </header>
  );
}

export function Vacio({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-borde bg-panel/40 px-6 py-16 text-center">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-suave">{texto}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Aviso({ msg, error }: { msg?: string; error?: string }) {
  if (!msg && !error) return null;
  return (
    <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-peligro/40 bg-peligro/10 text-peligro" : "border-acento/30 bg-acento/10 text-texto"}`}>
      {error ?? msg}
    </p>
  );
}
