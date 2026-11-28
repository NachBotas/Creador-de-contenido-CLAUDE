"use client";

// Si algo falla (por ejemplo, un botón de una página abierta antes de una actualización), lo decimos claro.
export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const desactualizada = /Server Action|failed to find|deployment/i.test(error.message);
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-20 text-center">
      <p className="text-lg font-semibold">{desactualizada ? "La app se actualizó" : "Algo salió mal"}</p>
      <p className="text-sm text-suave">
        {desactualizada
          ? "Tenías la página abierta desde antes de la última actualización. Recargala y volvé a intentar."
          : "Recargá la página y probá de nuevo. Si sigue pasando, avisale a Claude."}
      </p>
      <div className="flex gap-2">
        <button onClick={() => window.location.reload()} className="h-10 rounded-lg bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc">
          Recargar la página
        </button>
        {!desactualizada && (
          <button onClick={reset} className="h-10 rounded-lg border border-borde px-4 text-sm hover:bg-panel">
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
