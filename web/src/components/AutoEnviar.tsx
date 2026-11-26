"use client";

// Formulario GET que se aplica solo al cambiar un filtro.
export default function AutoEnviar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form
      method="get"
      className={className}
      onChange={(e) => {
        const el = e.target as HTMLElement;
        if (el.tagName !== "INPUT" || (el as HTMLInputElement).type !== "search") e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
