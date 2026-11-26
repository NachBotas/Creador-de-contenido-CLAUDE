"use client";

import { useState, useTransition } from "react";
import { crearLinkInvitacion } from "@/app/acciones";

// Genera un link para que un cliente conecte su Instagram sin la contraseña de la web.
export default function Invitar() {
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {!link ? (
        <button
          onClick={() => iniciar(async () => setLink(await crearLinkInvitacion()))}
          disabled={pendiente}
          className="h-10 rounded-lg border border-borde px-4 text-sm hover:bg-panel-2 disabled:opacity-60"
        >
          {pendiente ? "Generando…" : "Invitar a un cliente"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-3">
          <p className="text-xs text-suave">Mandale este link (dura 7 días). Lo abre, inicia sesión en Instagram y queda conectado:</p>
          <code className="break-all text-xs">{link}</code>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopiado(true);
            }}
            className="h-9 rounded-md bg-acento text-sm font-semibold text-black"
          >
            {copiado ? "¡Copiado!" : "Copiar link"}
          </button>
        </div>
      )}
    </div>
  );
}

export function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-borde">
      <div className="flex items-center justify-between bg-panel-2 px-3 py-1.5 text-[11px] font-medium text-suave">
        {etiqueta}
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(texto);
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          }}
          className="text-acento"
        >
          {ok ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-fondo px-3 py-2 text-xs">{texto}</pre>
    </div>
  );
}

export function Desconectar({ id, usuario }: { id: string; usuario: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      disabled={pendiente}
      onClick={async () => {
        if (!confirm(`¿Desconectar @${usuario}? Se borran sus métricas guardadas.`)) return;
        const { desconectarCuenta } = await import("@/app/acciones");
        iniciar(() => desconectarCuenta(id));
      }}
      className="rounded-md px-2 py-1 text-xs text-tenue hover:bg-peligro/10 hover:text-peligro disabled:opacity-50"
    >
      Desconectar
    </button>
  );
}
