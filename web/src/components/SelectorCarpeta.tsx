"use client";

import { useTransition } from "react";
import { asignarCarpetaIdea, asignarCarpetaReferente, eliminarCarpeta } from "@/app/acciones";

type Carpeta = { id: string; nombre: string };

export default function SelectorCarpeta({
  id,
  actual,
  carpetas,
  de,
}: {
  id: string;
  actual: string | null;
  carpetas: Carpeta[];
  de: "referente" | "idea";
}) {
  const [pendiente, iniciar] = useTransition();
  return (
    <select
      aria-label="Carpeta"
      defaultValue={actual ?? ""}
      disabled={pendiente}
      onChange={(e) => {
        const v = e.target.value || null;
        iniciar(() => (de === "referente" ? asignarCarpetaReferente(id, v) : asignarCarpetaIdea(id, v)));
      }}
      className="h-8 rounded-md border border-borde bg-fondo px-2 text-xs text-suave hover:text-texto disabled:opacity-50"
    >
      <option value="">Sin carpeta</option>
      {carpetas.map((c) => (
        <option key={c.id} value={c.id}>
          📁 {c.nombre}
        </option>
      ))}
    </select>
  );
}

export function BorrarCarpeta({ id, nombre }: { id: string; nombre: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      aria-label={`Eliminar carpeta ${nombre}`}
      onClick={() => confirm(`¿Eliminar la carpeta "${nombre}"? Los referentes e ideas quedan sin carpeta (no se borran).`) && iniciar(() => eliminarCarpeta(id))}
      className="ml-1 text-tenue hover:text-peligro disabled:opacity-50"
    >
      ×
    </button>
  );
}
