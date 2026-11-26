"use client";

import { useActionState } from "react";
import { entrar } from "../acciones";

export default function FormLogin() {
  const [estado, accion, enviando] = useActionState(entrar, undefined);
  return (
    <form action={accion} className="mt-6 flex flex-col gap-3">
      <label htmlFor="contrasena" className="text-xs font-medium text-suave">
        Contraseña
      </label>
      <input
        id="contrasena"
        name="contrasena"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        className="h-11 rounded-lg border border-borde bg-fondo px-3 text-sm outline-none focus:border-acento"
      />
      {estado?.error && <p className="text-sm text-peligro">{estado.error}</p>}
      <button
        disabled={enviando}
        className="mt-2 h-11 rounded-lg bg-acento text-sm font-semibold text-black transition hover:bg-acento-osc disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
