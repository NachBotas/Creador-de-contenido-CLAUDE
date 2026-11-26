import Link from "next/link";
import { notFound } from "next/navigation";
import { actualizarCuenta, conectarManychatAccion, desconectarManychat } from "@/app/acciones";
import { demografiaDe, diariasDe, listarCuentas, postsDe, type PostPropio } from "@/lib/metricas";
import { conexionDe, resumenConversaciones } from "@/lib/manychat";
import { urlPublica } from "@/lib/apify";
import { fechaCorta, fechaHora, numero } from "@/lib/formato";
import { Aviso } from "@/components/Encabezado";
import { Barras, Kpi, Linea, Tarjeta } from "@/components/Graficos";
import { Copiar, Desconectar } from "@/components/Invitar";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type SP = { tab?: string; dias?: string; msg?: string; error?: string; orden?: string };
const TABS = [
  ["resumen", "Resumen"],
  ["audiencia", "Audiencia"],
  ["contenido", "Contenido"],
  ["conversaciones", "Conversaciones"],
] as const;
const DIAS = [
  ["30", "30 días"],
  ["90", "90 días"],
  ["365", "1 año"],
] as const;

export default async function PanelCuenta({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<SP> }) {
  const { cuenta: id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const cuentas = await listarCuentas();
  const c = cuentas.find((x) => x.id === id);
  if (!c) notFound();
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "resumen";
  const dias = DIAS.some(([d]) => d === sp.dias) ? Number(sp.dias) : 30;
  const link = (cambios: Partial<SP>) => {
    const p = new URLSearchParams({ tab, dias: String(dias), ...cambios } as Record<string, string>);
    return `?${p}`;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/metricas" className="text-sm text-suave hover:text-texto">
          ← Cuentas
        </Link>
        <div className="flex gap-1 overflow-x-auto">
          {cuentas.map((x) => (
            <Link
              key={x.id}
              href={`/metricas/${x.id}?tab=${tab}`}
              className={`shrink-0 rounded-lg border px-3 py-1 text-xs ${x.id === id ? "border-acento/50 bg-acento/10" : "border-borde text-suave hover:text-texto"}`}
            >
              @{x.username}
            </Link>
          ))}
        </div>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        {c.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.foto_url} alt="" className="size-12 rounded-full object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">@{c.username}</h1>
          <p className="text-xs text-suave">
            {numero(c.seguidores)} seguidores · {numero(c.cantidad_posts)} publicaciones · actualizado {fechaHora(c.ultima_sync)}
          </p>
        </div>
        <form action={actualizarCuenta}>
          <input type="hidden" name="id" value={c.id} />
          <button className="h-9 rounded-lg border border-borde px-3 text-sm hover:bg-panel">Actualizar ahora</button>
        </form>
        <Desconectar id={c.id} usuario={c.username} />
      </header>

      <Aviso msg={sp.msg} error={sp.error ?? (c.ultimo_error ? `Último aviso de Instagram: ${c.ultimo_error}` : undefined)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Secciones de métricas" className="inline-flex rounded-lg bg-panel p-1 text-sm">
          {TABS.map(([t, nombre]) => (
            <Link key={t} href={link({ tab: t })} className={`rounded-md px-3 py-1.5 ${tab === t ? "bg-panel-2 text-texto" : "text-suave hover:text-texto"}`}>
              {nombre}
            </Link>
          ))}
        </nav>
        {tab !== "audiencia" && (
          <div className="inline-flex rounded-lg bg-panel p-1 text-xs">
            {DIAS.map(([d, nombre]) => (
              <Link key={d} href={link({ dias: d })} className={`rounded-md px-3 py-1.5 ${String(dias) === d ? "bg-panel-2 text-texto" : "text-suave hover:text-texto"}`}>
                {nombre}
              </Link>
            ))}
          </div>
        )}
      </div>

      {tab === "resumen" && <Resumen id={id} dias={dias} seguidores={c.seguidores} />}
      {tab === "audiencia" && <Audiencia id={id} />}
      {tab === "contenido" && <Contenido id={id} dias={dias} orden={sp.orden ?? "fecha"} link={link} />}
      {tab === "conversaciones" && <Conversaciones id={id} dias={dias} />}
    </div>
  );
}

async function Resumen({ id, dias, seguidores }: { id: string; dias: number; seguidores: number | null }) {
  const [diarias, posts] = await Promise.all([diariasDe(id, dias), postsDe(id)]);
  const nuevos = diarias.reduce((a, d) => a + (d.nuevos_seguidores ?? 0), 0);
  const alcance = diarias.reduce((a, d) => a + (d.alcance ?? 0), 0);
  const conSeguidores = diarias.filter((d) => d.seguidores !== null).map((d) => ({ x: d.fecha, y: d.seguidores! }));
  const conAlcance = diarias.filter((d) => d.alcance !== null).map((d) => ({ x: d.fecha, y: d.alcance! }));

  // Mejor día para publicar: promedio de interacciones por día de la semana
  const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const porDia = new Map<number, number[]>();
  for (const p of posts) {
    if (!p.fecha) continue;
    const d = new Date(p.fecha).getDay();
    porDia.set(d, [...(porDia.get(d) ?? []), p.interacciones ?? (p.likes ?? 0) + (p.comentarios ?? 0)]);
  }
  const promedios = [...porDia.entries()]
    .map(([d, v]) => ({ clave: diasSemana[d], valor: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }))
    .sort((a, b) => b.valor - a.valor);
  const suma = (k: keyof PostPropio) => posts.reduce((a, p) => a + (Number(p[k]) || 0), 0);
  const engagement = [
    { clave: "Me gusta", valor: suma("likes") },
    { clave: "Comentarios", valor: suma("comentarios") },
    { clave: "Guardados", valor: suma("guardados") },
    { clave: "Compartidos", valor: suma("compartidos") },
  ].filter((e) => e.valor > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Seguidores actuales" valor={numero(seguidores)} />
        <Kpi titulo={`Seguidores nuevos (${dias} días)`} valor={nuevos ? `+${numero(nuevos)}` : "—"} positivo={nuevos > 0} nota="Instagram informa hasta 30 días" />
        <Kpi titulo="Alcance del período" valor={numero(alcance || null)} />
        <Kpi titulo="Alcance promedio por día" valor={conAlcance.length ? numero(Math.round(alcance / conAlcance.length)) : "—"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Crecimiento de seguidores">
          {conSeguidores.length >= 2 ? (
            <Linea puntos={conSeguidores} etiqueta="Seguidores por día" />
          ) : (
            <p className="py-10 text-center text-sm text-suave">
              La curva se está armando: Instagram no da el total de días pasados, así que lo guardamos una vez por día.
            </p>
          )}
        </Tarjeta>
        <Tarjeta titulo="Alcance diario">
          {conAlcance.length >= 2 ? <Linea puntos={conAlcance} etiqueta="Alcance por día" /> : <p className="py-10 text-center text-sm text-suave">Todavía no hay datos de alcance.</p>}
        </Tarjeta>
        <Tarjeta titulo="Radiografía del engagement (últimos 30 posts)">
          {engagement.length ? <Barras filas={engagement} /> : <p className="py-6 text-center text-sm text-suave">Actualizá la cuenta para traer tus posts.</p>}
        </Tarjeta>
        <Tarjeta titulo="Mejor día para publicar (interacciones promedio)">
          {promedios.length ? <Barras filas={promedios} max={7} /> : <p className="py-6 text-center text-sm text-suave">Actualizá la cuenta para traer tus posts.</p>}
        </Tarjeta>
      </div>
    </div>
  );
}

const paises = new Intl.DisplayNames(["es"], { type: "region" });
const nombrePais = (codigo: string) => {
  try {
    return paises.of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
};

const GENEROS: Record<string, string> = { F: "Femenino", M: "Masculino", U: "Sin especificar" };

async function Audiencia({ id }: { id: string }) {
  const d = await demografiaDe(id);
  if (!d.genero.length && !d.edad.length && !d.pais.length) {
    return (
      <p className="rounded-xl border border-dashed border-borde py-12 text-center text-sm text-suave">
        Todavía no hay demografía. Tocá «Actualizar ahora». Instagram solo la da para cuentas con 100 seguidores o más.
      </p>
    );
  }
  d.pais = d.pais.map((p) => ({ ...p, clave: nombrePais(p.clave) }));
  const total = d.genero.reduce((a, g) => a + g.valor, 0);
  const top = (l: { clave: string; valor: number }[]) => l[0];
  const edadTop = [...d.edad].sort((a, b) => b.valor - a.valor)[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Total en la muestra" valor={numero(total || null)} />
        <Kpi titulo="Género principal" valor={top(d.genero) ? GENEROS[top(d.genero).clave] ?? top(d.genero).clave : "—"} nota={top(d.genero) && total ? `${Math.round((top(d.genero).valor / total) * 100)}% de la audiencia` : undefined} />
        <Kpi titulo="Edad dominante" valor={edadTop ? `${edadTop.clave} años` : "—"} />
        <Kpi titulo="País principal" valor={top(d.pais)?.clave ?? "—"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Por género">
          <Barras filas={d.genero.map((g) => ({ clave: GENEROS[g.clave] ?? g.clave, valor: g.valor }))} />
        </Tarjeta>
        <Tarjeta titulo="Por edad">
          <Barras filas={d.edad} max={10} />
        </Tarjeta>
        <Tarjeta titulo="Seguidores por país">
          <Barras filas={d.pais} />
        </Tarjeta>
        <Tarjeta titulo="Seguidores por ciudad">
          <Barras filas={d.ciudad} />
        </Tarjeta>
      </div>
      {d.actualizado && <p className="text-xs text-tenue">Según Instagram · actualizado {fechaHora(d.actualizado)}</p>}
    </div>
  );
}

async function Contenido({ id, dias, orden, link }: { id: string; dias: number; orden: string; link: (c: Partial<SP>) => string }) {
  const desde = Date.now() - dias * 86_400_000;
  const campos: Record<string, keyof PostPropio> = { fecha: "fecha", alcance: "alcance", guardados: "guardados", compartidos: "compartidos", comentarios: "comentarios" };
  const campo = campos[orden] ?? "fecha";
  const posts = (await postsDe(id))
    .filter((p) => !p.fecha || new Date(p.fecha).getTime() >= desde)
    .sort((a, b) => (campo === "fecha" ? String(b.fecha).localeCompare(String(a.fecha)) : (Number(b[campo]) || 0) - (Number(a[campo]) || 0)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1 text-xs">
        {Object.keys(campos).map((k) => (
          <Link key={k} href={link({ orden: k })} className={`rounded-md border px-2.5 py-1 capitalize ${orden === k ? "border-acento/50 bg-acento/10" : "border-borde text-suave"}`}>
            {k === "fecha" ? "Más recientes" : `Más ${k}`}
          </Link>
        ))}
      </div>
      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borde py-12 text-center text-sm text-suave">No hay publicaciones en este período.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {posts.map((p) => (
            <a key={p.id} href={p.permalink ?? "#"} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-borde bg-panel hover:border-suave/40">
              <div className="aspect-[4/5] bg-black">
                {p.miniatura_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.miniatura_url} alt="" loading="lazy" className="size-full object-cover" />
                )}
              </div>
              <div className="flex flex-col gap-1.5 p-3">
                <p className="line-clamp-2 text-xs">{p.caption || "Sin texto"}</p>
                <dl className="grid grid-cols-3 gap-1 text-[11px] tabular-nums text-suave">
                  <Dato t="Alcance" v={p.alcance} />
                  <Dato t="Vistas" v={p.vistas} />
                  <Dato t="Coment." v={p.comentarios} />
                  <Dato t="Guard." v={p.guardados} />
                  <Dato t="Compart." v={p.compartidos} />
                  <Dato t="Likes" v={p.likes} />
                </dl>
                <p className="text-[10px] text-tenue">{fechaCorta(p.fecha)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Dato({ t, v }: { t: string; v: number | null }) {
  return (
    <div>
      <dt className="text-[10px] text-tenue">{t}</dt>
      <dd>{numero(v)}</dd>
    </div>
  );
}

async function Conversaciones({ id, dias }: { id: string; dias: number }) {
  const conexion = await conexionDe(id);
  if (!conexion) {
    return (
      <form action={conectarManychatAccion} className="flex max-w-lg flex-col gap-3 rounded-xl border border-borde bg-panel p-5">
        <p className="font-medium">Conectá ManyChat</p>
        <p className="text-sm text-suave">Para saber qué reel, carrusel o historia trajo cada conversación.</p>
        <input type="hidden" name="cuenta" value={id} />
        <label htmlFor="token" className="text-xs text-suave">
          Token de ManyChat (Settings → API)
        </label>
        <input id="token" name="token" type="password" required autoComplete="off" placeholder="Pegalo acá" className="h-10 rounded-md border border-borde bg-fondo px-3 text-sm outline-none focus:border-acento" />
        <p className="text-[11px] text-tenue">Solo lo usamos para verificar la cuenta y leer su nombre. Se guarda cifrado y nunca se manda ningún mensaje.</p>
        <button className="h-10 rounded-md bg-acento text-sm font-semibold text-black hover:bg-acento-osc">Conectar</button>
        <p className="text-[11px] text-tenue">Se cuentan las conversaciones desde que conectás: ManyChat no permite leer las anteriores.</p>
      </form>
    );
  }
  const r = await resumenConversaciones(conexion.id, dias);
  const url = `${urlPublica() ?? ""}/api/manychat/evento`;
  const tipos = [
    { clave: "Reels", valor: r.porTipo.get("reel") ?? 0 },
    { clave: "Historias", valor: r.porTipo.get("historia") ?? 0 },
    { clave: "Carruseles", valor: r.porTipo.get("carrusel") ?? 0 },
    { clave: "Otras", valor: r.porTipo.get("otro") ?? 0 },
  ].filter((t) => t.valor > 0);
  const porDia = [...r.porDia.entries()].sort().map(([x, y]) => ({ x, y }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo={`Personas que escribieron (${dias} días)`} valor={numero(r.total)} />
        <Kpi titulo="Etiquetas con conversaciones" valor={String(r.porEtiqueta.length)} />
        <Kpi titulo="Mejor contenido" valor={r.porEtiqueta[0]?.[0] ?? "—"} nota={r.porEtiqueta[0] ? `${r.porEtiqueta[0][1]} personas` : undefined} />
        <Kpi titulo="Cuenta de ManyChat" valor={conexion.nombre_pagina ?? "—"} />
      </div>
      {r.total > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Por contenido (etiqueta)">
            <Barras filas={r.porEtiqueta.map(([clave, valor]) => ({ clave, valor }))} max={20} />
          </Tarjeta>
          <div className="flex flex-col gap-4">
            <Tarjeta titulo="Por tipo">
              <Barras filas={tipos} />
            </Tarjeta>
            {porDia.length >= 2 && (
              <Tarjeta titulo="Por día">
                <Linea puntos={porDia} alto={150} etiqueta="Conversaciones por día" />
              </Tarjeta>
            )}
          </div>
        </div>
      )}

      <details className="rounded-xl border border-borde bg-panel p-5" open={r.total === 0}>
        <summary className="cursor-pointer font-medium">Cómo configurar cada flow de ManyChat</summary>
        <ol className="mt-4 flex list-inside list-decimal flex-col gap-3 text-sm text-suave">
          <li>
            En ManyChat abrí el flow del contenido → <strong className="text-texto">Acciones → Solicitud externa</strong> (External Request) → método{" "}
            <strong className="text-texto">POST</strong>. Requiere ManyChat Pro.
          </li>
          <li>Pegá estos tres datos:</li>
        </ol>
        <div className="mt-3 flex flex-col gap-2">
          <Copiar etiqueta="URL de la solicitud" texto={url} />
          <Copiar etiqueta="Encabezado · Key: Authorization · Value:" texto={`Bearer ${conexion.secreto}`} />
          <Copiar etiqueta="Cuerpo (JSON)" texto={`{\n  "etiqueta": "reel-nombre-del-contenido",\n  "subscriber_id": "{{user.id}}"\n}`} />
        </div>
        <ul className="mt-3 flex list-inside list-disc flex-col gap-1.5 text-xs text-suave">
          <li>
            El <code>{"{{user.id}}"}</code> no se escribe: se elige con el botón de ManyChat para agregar un campo → <em>Id de contacto</em>.
          </li>
          <li>
            Empezá la etiqueta con <code>reel-</code>, <code>historia-</code> o <code>carrusel-</code> para que la app sepa el tipo. Ejemplo: <code>reel-talking-head-precios</code>.
          </li>
          <li>Para los demás flows duplicá el paso y cambiá solo la etiqueta.</li>
        </ul>
        <form action={desconectarManychat} className="mt-4">
          <input type="hidden" name="id" value={conexion.id} />
          <input type="hidden" name="cuenta" value={id} />
          <button className="text-xs text-tenue hover:text-peligro">Desconectar ManyChat</button>
        </form>
      </details>
    </div>
  );
}
