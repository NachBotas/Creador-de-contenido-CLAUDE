"use client";

import { useTransition } from "react";
import { eliminarContacto, eliminarNegocio } from "@/app/acciones";

export function BorrarNegocio({ id, nombre }: { id: string; nombre: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => confirm(`¿Eliminar "${nombre}"? Se borran sus contactos y la conexión con ManyChat.`) && iniciar(() => eliminarNegocio(id))}
      className="text-xs text-tenue hover:text-peligro disabled:opacity-50"
    >
      Eliminar negocio
    </button>
  );
}

export function BorrarContacto({ id, negocio }: { id: string; negocio: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => confirm("¿Quitar a esta persona de la lista? En ManyChat no se borra nada.") && iniciar(() => eliminarContacto(id, negocio))}
      className="text-xs text-tenue hover:text-peligro disabled:opacity-50"
    >
      Quitar de la lista
    </button>
  );
}
