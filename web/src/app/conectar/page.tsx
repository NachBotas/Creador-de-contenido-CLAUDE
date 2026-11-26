import { invitacionValida } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conectar Instagram", robots: { index: false } };

// Página pública para clientes: conectan su Instagram con el login oficial, sin compartir contraseñas.
export default async function Conectar({ searchParams }: { searchParams: Promise<{ inv?: string }> }) {
  const { inv } = await searchParams;
  const valida = await invitacionValida(inv);
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-borde bg-panel p-8">
        {valida ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Conectá tu cuenta de Instagram</h1>
            <p className="mt-3 text-sm leading-relaxed text-suave">
              Te van a llevar a la página oficial de Instagram para que inicies sesión y autorices el acceso a tus estadísticas
              (seguidores, alcance y audiencia). <strong className="text-texto">Tu contraseña nunca se comparte.</strong>
            </p>
            <ul className="mt-4 list-inside list-disc text-sm text-suave">
              <li>La cuenta tiene que ser profesional (Empresa o Creador).</li>
              <li>Podés quitar el acceso cuando quieras desde la configuración de Instagram.</li>
            </ul>
            <a
              href={`/api/instagram/conectar?inv=${encodeURIComponent(inv!)}`}
              className="mt-6 flex h-11 items-center justify-center rounded-lg bg-acento text-sm font-semibold text-black hover:bg-acento-osc"
            >
              Conectar con Instagram
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Este link no sirve</h1>
            <p className="mt-3 text-sm text-suave">Puede que haya vencido (duran 7 días). Pedile un link nuevo a quien te lo mandó.</p>
          </>
        )}
      </div>
    </main>
  );
}
