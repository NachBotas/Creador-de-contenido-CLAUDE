import Link from "next/link";
import { notFound } from "next/navigation";
import { actualizarContacto, guardarCierre } from "@/app/acciones";
import { listarNegocios, obtenerContacto } from "@/lib/negocios";
import { origen, recorrido, ultimoToque } from "@/lib/etiquetas";
import { fechaHora } from "@/lib/formato";
import { Aviso } from "@/components/Encabezado";
import Recorrido, { Chip } from "@/components/Recorrido";
import { BorrarContacto } from "@/components/ControlesNegocio";

export const dynamic = "force-dynamic";

const input = "h-10 rounded-md border border-borde bg-fondo px-3 text-sm outline-none focus:border-acento";

export default async function FichaContacto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const { id } = await params;
  const { msg, error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [c, negocios] = await Promise.all([obtenerContacto(id), listarNegocios()]);
  if (!c) notFound();
  const negocio = negocios.find((n) => n.id === c.negocio_id);
  const pasos = recorrido(c.etiquetas);
  const cierre = c.fecha_cierre ? new Date(`${c.fecha_cierre}T12:00:00Z`) : null;
  const o = origen(pasos);
  const u = ultimoToque(pasos, cierre);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href={`/clientes?n=${c.negocio_id}`} className="text-sm text-suave hover:text-texto">
        ← {negocio?.nombre ?? "Clientes"}
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        {c.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.foto_url} alt="" className="size-14 rounded-full object-cover" />
        ) : (
          <span className="size-14 rounded-full bg-panel-2" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{c.nombre ?? `Contacto ${c.subscriber_id}`}</h1>
          <p className="text-xs text-suave">
            {[c.ig_username && `@${c.ig_username}`, c.email, c.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          </p>
          <p className="text-[11px] text-tenue">
            En ManyChat desde {fechaHora(c.suscripto_en)} · última interacción {fechaHora(c.ultima_interaccion)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.link_chat && (
            <a href={c.link_chat} target="_blank" rel="noreferrer" className="flex h-9 items-center rounded-lg border border-borde px-3 text-sm hover:bg-panel">
              Abrir chat ↗
            </a>
          )}
          <form action={actualizarContacto}>
            <input type="hidden" name="id" value={c.id} />
            <button className="h-9 rounded-lg border border-borde px-3 text-sm hover:bg-panel">Actualizar etiquetas</button>
          </form>
        </div>
      </header>
      <Aviso msg={msg} error={error} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="rounded-xl border border-borde bg-panel p-5">
          <h2 className="mb-1 font-medium">Recorrido</h2>
          <div className="mb-5 flex flex-wrap gap-2 text-xs text-suave">
            {o && (
              <span className="flex items-center gap-1.5">
                Entró por <Chip tipo={o.tipo} texto={o.nombre} />
              </span>
            )}
            {u && u.nombre !== o?.nombre && (
              <span className="flex items-center gap-1.5">
                · Último antes de {c.cerrado ? "cerrar" : "hoy"} <Chip tipo={u.tipo} texto={u.nombre} />
              </span>
            )}
          </div>
          <Recorrido pasos={pasos} cierre={c.cerrado ? cierre : null} />
        </section>

        <form action={guardarCierre} className="flex h-fit flex-col gap-3 rounded-xl border border-borde bg-panel p-5">
          <input type="hidden" name="id" value={c.id} />
          <h2 className="font-medium">¿Cerró?</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="cerrado" value="1" defaultChecked={c.cerrado} className="size-4 accent-[var(--color-acento)]" />
            Es cliente
          </label>
          <label className="flex flex-col gap-1 text-xs text-suave">
            Fecha de cierre
            <input type="date" name="fecha" defaultValue={c.fecha_cierre ?? new Date().toISOString().slice(0, 10)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-suave">
            Monto (opcional)
            <input name="monto" inputMode="decimal" defaultValue={c.monto ?? ""} placeholder="Ej: 500" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-suave">
            Nota (opcional)
            <textarea name="nota" defaultValue={c.nota ?? ""} rows={3} className="rounded-md border border-borde bg-fondo px-3 py-2 text-sm outline-none focus:border-acento" />
          </label>
          <button className="h-10 rounded-md bg-acento text-sm font-semibold text-black hover:bg-acento-osc">Guardar</button>
          <BorrarContacto id={c.id} negocio={c.negocio_id} />
        </form>
      </div>
    </div>
  );
}
