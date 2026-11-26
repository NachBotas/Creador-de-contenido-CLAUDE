"use client";

import { useTransition } from "react";
import { cambiarFormato } from "@/app/acciones";
import type { Formato } from "@/lib/tipos";

export default function SelectorFormato({ id, actual, formatos }: { id: string; actual: number | null; formatos: Formato[] }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <select
      aria-label="Formato del reel"
      defaultValue={actual ?? ""}
      disabled={pendiente}
      onChange={(e) => iniciar(() => cambiarFormato(id, e.target.value ? Number(e.target.value) : null))}
      className="h-8 w-full rounded-md border border-borde bg-fondo px-2 text-xs text-suave hover:text-texto disabled:opacity-50"
    >
      <option value="">Sin formato</option>
      {formatos.map((f) => (
        <option key={f.id} value={f.id}>
          {f.nombre}
        </option>
      ))}
    </select>
  );
}
