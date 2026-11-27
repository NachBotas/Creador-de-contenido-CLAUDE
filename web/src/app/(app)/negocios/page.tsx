import { conectarManychatNegocio, crearNegocio, desconectarManychatNegocio, editarNegocio } from "@/app/acciones";
import { listarNegocios, MAX_NEGOCIOS } from "@/lib/negocios";
import { conexionDeNegocio } from "@/lib/manychat";
import { urlPublica } from "@/lib/apify";
import Encabezado, { Aviso } from "@/components/Encabezado";
import { BorrarNegocio } from "@/components/ControlesNegocio";
import { Copiar } from "@/components/Invitar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Negocios · Radar de contenido" };

const input = "h-10 rounded-md border border-borde bg-fondo px-3 text-sm outline-none focus:border-acento";

export default async function Negocios({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const { msg, error } = await searchParams;
  const negocios = await listarNegocios();
  const conexiones = await Promise.all(negocios.map((n) => conexionDeNegocio(n.id)));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado titulo="Negocios" bajada={`Cada negocio es un Instagram con su propia cuenta de ManyChat · ${negocios.length} de ${MAX_NEGOCIOS}`} />
      <Aviso msg={msg} error={error} />

      {negocios.map((n, i) => {
        const c = conexiones[i];
        return (
          <section key={n.id} className="flex flex-col gap-4 rounded-xl border border-borde bg-panel p-5">
            <form action={editarNegocio} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={n.id} />
              <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1 text-xs text-suave">
                Nombre
                <input name="nombre" defaultValue={n.nombre} required maxLength={40} className={input} />
              </label>
              <label className="flex min-w-0 flex-1 basis-40 flex-col gap-1 text-xs text-suave">
                Instagram (opcional)
                <input name="ig" defaultValue={n.ig_username ? `@${n.ig_username}` : ""} placeholder="@usuario" className={input} />
              </label>
              <button className="h-10 rounded-md border border-borde px-4 text-sm hover:bg-panel-2">Guardar</button>
            </form>

            {c ? (
              <div className="flex flex-col gap-3 rounded-lg border border-acento/30 bg-acento/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="mr-2 inline-block size-2 rounded-full bg-acento" aria-hidden="true" />
                    ManyChat conectado: <strong>{c.nombre_pagina}</strong>
                  </p>
                  <form action={desconectarManychatNegocio}>
                    <input type="hidden" name="negocio" value={n.id} />
                    <button className="text-xs text-tenue hover:text-peligro">Desconectar ManyChat</button>
                  </form>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-suave">Opcional: contar conversaciones por contenido con «Solicitud externa» (ManyChat Pro)</summary>
                  <div className="mt-3 flex flex-col gap-2">
                    <Copiar etiqueta="URL (método POST)" texto={`${urlPublica() ?? ""}/api/manychat/evento`} />
                    <Copiar etiqueta="Encabezado · Key: Authorization · Value:" texto={`Bearer ${c.secreto}`} />
                    <Copiar etiqueta="Cuerpo (JSON)" texto={`{\n  "etiqueta": "reel 27/11",\n  "subscriber_id": "{{user.id}}"\n}`} />
                    <p className="text-xs text-tenue">
                      El <code>{"{{user.id}}"}</code> se elige con el botón de ManyChat para agregar un campo → Id de contacto.
                    </p>
                  </div>
                </details>
              </div>
            ) : (
              <form action={conectarManychatNegocio} className="flex flex-col gap-2 rounded-lg border border-dashed border-borde p-4">
                <input type="hidden" name="negocio" value={n.id} />
                <label htmlFor={`token-${n.id}`} className="text-sm font-medium">
                  Conectar ManyChat
                </label>
                <p className="text-xs text-suave">En ManyChat de este negocio: Settings → API → copiá el token y pegalo acá. Se guarda cifrado; solo se usa para leer contactos y etiquetas.</p>
                <div className="flex flex-wrap gap-2">
                  <input id={`token-${n.id}`} name="token" type="password" required autoComplete="off" placeholder="Token de ManyChat" className={`${input} min-w-0 flex-1 basis-60`} />
                  <button className="h-10 rounded-md bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc">Conectar</button>
                </div>
              </form>
            )}
            <div>
              <BorrarNegocio id={n.id} nombre={n.nombre} />
            </div>
          </section>
        );
      })}

      {negocios.length < MAX_NEGOCIOS && (
        <form action={crearNegocio} className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-borde p-5">
          <p className="w-full text-sm font-medium">Agregar negocio</p>
          <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1 text-xs text-suave">
            Nombre
            <input name="nombre" required maxLength={40} placeholder="Ej: Nacho Botas" className={input} />
          </label>
          <label className="flex min-w-0 flex-1 basis-40 flex-col gap-1 text-xs text-suave">
            Instagram (opcional)
            <input name="ig" placeholder="@usuario" className={input} />
          </label>
          <button className="h-10 rounded-md bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc">Agregar</button>
        </form>
      )}
    </div>
  );
}
