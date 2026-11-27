import Link from "next/link";
import { abrirContacto } from "@/app/acciones";
import { listarContactos, listarNegocios, type Contacto } from "@/lib/negocios";
import { buscarContactos, conexionDeNegocio, type Suscriptor } from "@/lib/manychat";
import { origen, recorrido, TIPOS, ultimoToque, type TipoEtiqueta } from "@/lib/etiquetas";
import Encabezado, { Aviso, Vacio } from "@/components/Encabezado";
import { Barras, Kpi, Tarjeta } from "@/components/Graficos";
import { Chip } from "@/components/Recorrido";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes · Radar de contenido" };

type SP = { n?: string; q?: string; msg?: string; error?: string };

function analizar(contactos: Contacto[]) {
  const cerrados = contactos.filter((c) => c.cerrado);
  const porOrigen = new Map<TipoEtiqueta, number>();
  const porUltimo = new Map<TipoEtiqueta, number>();
  const porEtiqueta = new Map<string, number>();
  const tocados = new Map<TipoEtiqueta, number>();
  for (const c of cerrados) {
    const pasos = recorrido(c.etiquetas);
    const cierre = c.fecha_cierre ? new Date(`${c.fecha_cierre}T12:00:00Z`) : null;
    const o = origen(pasos);
    const u = ultimoToque(pasos, cierre);
    if (o) {
      porOrigen.set(o.tipo, (porOrigen.get(o.tipo) ?? 0) + 1);
      porEtiqueta.set(o.nombre, (porEtiqueta.get(o.nombre) ?? 0) + 1);
    }
    if (u) porUltimo.set(u.tipo, (porUltimo.get(u.tipo) ?? 0) + 1);
    for (const t of new Set(pasos.map((p) => p.tipo))) tocados.set(t, (tocados.get(t) ?? 0) + 1);
  }
  const filas = (m: Map<TipoEtiqueta, number>) => [...m.entries()].map(([t, v]) => ({ clave: TIPOS[t].nombre, valor: v })).sort((a, b) => b.valor - a.valor);
  return {
    cerrados: cerrados.length,
    monto: cerrados.reduce((a, c) => a + (Number(c.monto) || 0), 0),
    porOrigen: filas(porOrigen),
    porUltimo: filas(porUltimo),
    tocados: filas(tocados),
    porEtiqueta: [...porEtiqueta.entries()].map(([clave, valor]) => ({ clave, valor })).sort((a, b) => b.valor - a.valor),
  };
}

const plata = (n: number) => (n ? n.toLocaleString("es-AR", { maximumFractionDigits: 0 }) : "—");

export default async function Clientes({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const negocios = await listarNegocios();
  if (!negocios.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <Encabezado titulo="Clientes" bajada="De qué contenido viene cada persona que cerró." />
        <div className="mt-6">
          <Vacio titulo="Primero creá tus negocios" texto="Cada negocio es un Instagram con su ManyChat. Creá hasta 5 y conectá el token de cada uno.">
            <Link href="/negocios" className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-black">
              Ir a Negocios
            </Link>
          </Vacio>
        </div>
      </div>
    );
  }
  const todos = sp.n === "todos";
  const negocio = todos ? null : (negocios.find((x) => x.id === sp.n) ?? negocios[0]);
  const contactos = await listarContactos(negocio?.id);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado titulo="Clientes" bajada="Buscá a una persona, mirá de qué etiquetas vino y marcá quién cerró." />
      <nav aria-label="Negocios" className="flex flex-wrap gap-1">
        {negocios.map((x) => (
          <Link
            key={x.id}
            href={`/clientes?n=${x.id}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${negocio?.id === x.id ? "border-acento/50 bg-acento/10" : "border-borde text-suave hover:text-texto"}`}
          >
            {x.nombre}
          </Link>
        ))}
        {negocios.length > 1 && (
          <Link href="/clientes?n=todos" className={`rounded-lg border px-3 py-1.5 text-sm ${todos ? "border-acento/50 bg-acento/10" : "border-borde text-suave hover:text-texto"}`}>
            Todos los negocios
          </Link>
        )}
      </nav>
      <Aviso msg={sp.msg} error={sp.error} />
      {todos ? <Comparativa negocios={negocios} contactos={contactos} /> : <VistaNegocio negocio={negocio!} contactos={contactos} q={sp.q ?? ""} />}
    </div>
  );
}

async function VistaNegocio({ negocio, contactos, q }: { negocio: { id: string; nombre: string }; contactos: Contacto[]; q: string }) {
  const conexion = await conexionDeNegocio(negocio.id);
  let resultados: Suscriptor[] = [];
  let errorBusqueda = "";
  if (conexion && q.trim().length >= 2) {
    try {
      resultados = await buscarContactos(negocio.id, q);
    } catch (e) {
      errorBusqueda = (e as Error).message;
    }
  }
  const a = analizar(contactos);

  return (
    <>
      {!conexion ? (
        <Vacio titulo={`${negocio.nombre} no tiene ManyChat conectado`} texto="Conectá el token de ManyChat de este negocio para poder buscar personas.">
          <Link href="/negocios" className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-black">
            Conectar ManyChat
          </Link>
        </Vacio>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-borde bg-panel p-4">
          <form method="get" className="flex flex-wrap gap-2">
            <input type="hidden" name="n" value={negocio.id} />
            <label htmlFor="q" className="sr-only">
              Buscar persona
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              required
              minLength={2}
              placeholder="Nombre como figura en ManyChat, email, teléfono o link del chat"
              className="h-10 min-w-0 flex-1 basis-72 rounded-md border border-borde bg-fondo px-3 text-sm outline-none focus:border-acento"
            />
            <button className="h-10 rounded-md bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc">Buscar</button>
          </form>
          <p className="text-[11px] text-tenue">
            ManyChat ({conexion.nombre_pagina}) solo permite buscar por nombre, email, teléfono o ID. Para buscar por @ de Instagram, abrí el chat en ManyChat y pegá acá su link.
          </p>
          {errorBusqueda && <p className="text-sm text-peligro">{errorBusqueda}</p>}
          {q && !errorBusqueda && resultados.length === 0 && <p className="text-sm text-suave">No encontré a nadie con «{q}».</p>}
          {resultados.length > 0 && (
            <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
              {resultados.slice(0, 30).map((s) => {
                const pasos = recorrido(s.tags ?? []);
                const o = origen(pasos);
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    {s.profile_pic ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.profile_pic} alt="" className="size-9 rounded-full object-cover" />
                    ) : (
                      <span className="size-9 rounded-full bg-panel-2" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name || [s.first_name, s.last_name].filter(Boolean).join(" ") || `Contacto ${s.id}`}</p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-suave">
                        {s.ig_username ? `@${s.ig_username} · ` : ""}
                        {pasos.length} etiquetas {o && <Chip tipo={o.tipo} texto={`Vino por: ${o.nombre}`} />}
                      </p>
                    </div>
                    <form action={abrirContacto}>
                      <input type="hidden" name="negocio" value={negocio.id} />
                      <input type="hidden" name="subscriber" value={s.id} />
                      <button className="h-9 rounded-md border border-borde px-3 text-sm hover:bg-panel-2">Ver recorrido</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Clientes cerrados" valor={String(a.cerrados)} />
        <Kpi titulo="Facturado (marcado)" valor={plata(a.monto)} />
        <Kpi titulo="Origen que más cierra" valor={a.porOrigen[0]?.clave ?? "—"} />
        <Kpi titulo="Personas en seguimiento" valor={String(contactos.length - a.cerrados)} />
      </div>

      {a.cerrados > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Tarjeta titulo="Por dónde entraron (primer contacto)">
            <Barras filas={a.porOrigen} />
          </Tarjeta>
          <Tarjeta titulo="Qué los terminó de convencer (último antes de cerrar)">
            <Barras filas={a.porUltimo} />
          </Tarjeta>
          <Tarjeta titulo="Contenidos de origen con más cierres">
            <Barras filas={a.porEtiqueta} max={10} />
          </Tarjeta>
        </div>
      )}

      <Lista contactos={contactos} />
    </>
  );
}

function Lista({ contactos, nombres }: { contactos: Contacto[]; nombres?: Map<string, string> }) {
  if (!contactos.length) return <p className="text-sm text-suave">Todavía no abriste ninguna ficha. Buscá a alguien arriba y tocá «Ver recorrido».</p>;
  return (
    <section className="overflow-x-auto rounded-xl border border-borde bg-panel">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-suave">
          <tr className="border-b border-borde">
            <th className="px-4 py-2.5 font-medium">Persona</th>
            {nombres && <th className="px-4 py-2.5 font-medium">Negocio</th>}
            <th className="px-4 py-2.5 font-medium">Vino por</th>
            <th className="px-4 py-2.5 font-medium">Etiquetas</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {contactos.map((c) => {
            const o = origen(recorrido(c.etiquetas));
            return (
              <tr key={c.id} className="border-b border-borde last:border-0 hover:bg-panel-2/50">
                <td className="px-4 py-2.5">
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                    {c.nombre ?? `Contacto ${c.subscriber_id}`}
                  </Link>
                  {c.ig_username && <span className="block text-xs text-tenue">@{c.ig_username}</span>}
                </td>
                {nombres && <td className="px-4 py-2.5 text-suave">{nombres.get(c.negocio_id)}</td>}
                <td className="px-4 py-2.5">{o ? <Chip tipo={o.tipo} texto={o.nombre} /> : <span className="text-tenue">—</span>}</td>
                <td className="px-4 py-2.5 tabular-nums text-suave">{c.etiquetas.length}</td>
                <td className="px-4 py-2.5">
                  {c.cerrado ? (
                    <span className="rounded-full bg-ganador/15 px-2 py-0.5 text-xs font-medium text-ganador">Cliente{c.fecha_cierre ? ` · ${c.fecha_cierre.slice(8, 10)}/${c.fecha_cierre.slice(5, 7)}` : ""}</span>
                  ) : (
                    <span className="text-xs text-tenue">En seguimiento</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Comparativa({ negocios, contactos }: { negocios: { id: string; nombre: string }[]; contactos: Contacto[] }) {
  const total = analizar(contactos);
  const nombres = new Map(negocios.map((n) => [n.id, n.nombre]));
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {negocios.map((n) => {
          const a = analizar(contactos.filter((c) => c.negocio_id === n.id));
          return (
            <Link key={n.id} href={`/clientes?n=${n.id}`} className="rounded-xl border border-borde bg-panel p-4 hover:border-suave/40">
              <p className="font-medium">{n.nombre}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{a.cerrados}</p>
              <p className="text-xs text-tenue">clientes cerrados · {plata(a.monto)} facturado</p>
              <p className="mt-2 text-xs text-suave">Origen que más cierra: {a.porOrigen[0]?.clave ?? "—"}</p>
            </Link>
          );
        })}
      </div>
      {total.cerrados > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Todos los negocios · por dónde entraron">
            <Barras filas={total.porOrigen} />
          </Tarjeta>
          <Tarjeta titulo="Todos los negocios · qué los terminó de convencer">
            <Barras filas={total.porUltimo} />
          </Tarjeta>
        </div>
      )}
      <Lista contactos={contactos} nombres={nombres} />
    </>
  );
}
