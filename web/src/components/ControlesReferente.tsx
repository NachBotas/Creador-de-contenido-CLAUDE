"use client";

import { useTransition } from "react";
import { cambiarInterruptor, eliminarFormato, eliminarReferente } from "@/app/acciones";

export function Interruptor({ id, campo, valor, texto }: { id: string; campo: "contenido_activo" | "historias_activo"; valor: boolean; texto: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      disabled={pendiente}
      onClick={() => iniciar(() => cambiarInterruptor(id, campo, !valor))}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
        valor ? "border-acento/40 bg-acento/10 text-texto" : "border-borde text-tenue"
      }`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${valor ? "bg-acento" : "bg-tenue"}`} />
      {texto}
    </button>
  );
}

export function BotonEliminar({ id, usuario }: { id: string; usuario: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => {
        if (confirm(`¿Eliminar a @${usuario}? Se borran también sus publicaciones e historias guardadas.`)) iniciar(() => eliminarReferente(id));
      }}
      className="rounded-md px-2 py-1 text-xs text-tenue hover:bg-peligro/10 hover:text-peligro disabled:opacity-50"
    >
      Eliminar
    </button>
  );
}

export function BotonEliminarFormato({ id, nombre }: { id: number; nombre: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      aria-label={`Eliminar formato ${nombre}`}
      onClick={() => {
        if (confirm(`¿Eliminar el formato "${nombre}"? Los reels que lo tenían quedan sin formato.`)) iniciar(() => eliminarFormato(id));
      }}
      className="ml-1 text-tenue hover:text-peligro disabled:opacity-50"
    >
      ×
    </button>
  );
}
