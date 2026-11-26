export const metadata = { title: "Conectar Instagram", robots: { index: false } };

export default async function Listo({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-borde bg-panel p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{error ? "No se pudo conectar" : "¡Listo, cuenta conectada!"}</h1>
        <p className="mt-3 text-sm text-suave">{error ?? "Ya podés cerrar esta pestaña."}</p>
      </div>
    </main>
  );
}
