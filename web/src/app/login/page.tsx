import FormLogin from "./form";

export const metadata = { title: "Entrar · Radar de contenido" };

export default function Login() {
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-borde bg-panel p-8">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-semibold tracking-tight">Radar de contenido</span>
        </div>
        <p className="mt-2 text-sm text-suave">Ingresá tu contraseña para ver tu base de referencias.</p>
        <FormLogin />
      </div>
    </main>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1a1d24" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#c6f432" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="3.5" fill="#c6f432" />
    </svg>
  );
}
