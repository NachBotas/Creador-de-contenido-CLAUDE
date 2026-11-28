"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Ventana por encima de la página. Se cierra con Esc, con la ✕ o tocando afuera (vuelve atrás).
export default function ModalRuta({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.back();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [router]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true" aria-label="Detalle de la publicación">
      <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={() => router.back()} className="fixed inset-0 cursor-default" />
      <div className="relative mx-auto max-w-6xl rounded-2xl border border-borde bg-panel p-4 shadow-2xl sm:p-6">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full text-xl text-suave hover:bg-panel-2 hover:text-texto"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
