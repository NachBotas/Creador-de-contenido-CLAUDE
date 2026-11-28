import Link from "next/link";
import { db } from "@/lib/supabase";
import { listarCarpetas, listarFormatos, listarReferentes } from "@/lib/datos";
import { fechaCorta, multiplicador, numero } from "@/lib/formato";
import { PRECIO_TRANSCRIPCION } from "@/lib/apify";
import { pedirHooksAccion } from "@/app/acciones";
import Encabezado, { Aviso, Vacio } from "@/components/Encabezado";
import ProgresoSync from "@/components/ProgresoSync";
import { BotonGuardarHook, CopiarHooks, FormPedirHooks, SelectorCarpetaHook } from "@/components/HooksCliente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banco de hooks · Radar de contenido" };

type Fila = {
  id: string;
  referente_id: string;
  fecha_publicacion: string | null;
  miniatura_url: string | null;
  hook: string | null;
  transcripcion: string | null;
  outlier: number | null;
  comentarios: number | null;
  vistas: number | null;
  formato_id: number | null;
  es_ganador: boolean;
};

const CAMPOS = "id, referente_id, fecha_publicacion, miniatura_url, hook, transcripcion, outlier, comentarios, vistas, formato_id, es_ganador";
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function textoHook(f: Fila) {
  return (f.hook || f.transcripcion?.split(/(?<=[.!?])\s/)[0] || "").trim();
}

export default async function Hooks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const vista = uno(sp.vista) === "lista" ? "lista" : uno(sp.vista) === "pedir" ? "pedir" : "banco";
  const carpeta = uno(sp.carpeta);
  const cuenta = uno(sp.cuenta);

  const [referentes, carpetas, formatos, guardadosRes] = await Promise.all([
    listarReferentes(),
    listarCarpetas(),
    listarFormatos(),
    db().from("hooks_guardados").select("publicacion_id, carpeta_id, created_at").order("created_at", { ascending: false }),
  ]);
  const guardados = new Map((guardadosRes.data ?? []).map((g) => [g.publicacion_id as string, g.carpeta_id as string | null]));
  const usuario = new Map(referentes.map((r) => [r.id, r.ig_username]));
  const formato = new Map(formatos.map((f) => [f.id, f.nombre]));

  let filas: Fila[] = [];
  let candidatos: { id: string; referente_id: string; fecha: string | null; ganador: boolean; outlier: number | null }[] = [];

  if (vista === "pedir") {
    const { data } = await db()
      .from("publicaciones")
      .select("id, referente_id, fecha_publicacion, es_ganador, outlier")
      .eq("tipo", "reel")
      .is("hook", null)
      .is("transcripcion", null)
      .order("outlier", { ascending: false, nullsFirst: false })
      .limit(3000);
    candidatos = (data ?? []).map((d) => ({ id: d.id, referente_id: d.referente_id, fecha: d.fecha_publicacion, ganador: d.es_ganador, outlier: d.outlier }));
  } else if (vista === "lista") {
    const ids = [...guardados.entries()].filter(([, c]) => (carpeta === "sin" ? c === null : carpeta ? c === carpeta : true)).map(([id]) => id);
    if (ids.length) {
      const { data } = await db().from("publicaciones").select(CAMPOS).in("id", ids);
      const orden = new Map(ids.map((id, i) => [id, i]));
      filas = ((data ?? []) as Fila[]).sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0));
    }
  } else {
    let q = db().from("publicaciones").select(CAMPOS).eq("tipo", "reel").or("hook.not.is.null,transcripcion.not.is.null");
    if (cuenta) q = q.eq("referente_id", cuenta);
    if (carpeta) {
      const ids = referentes.filter((r) => r.carpeta_id === carpeta).map((r) => r.id);
      q = q.in("referente_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data } = await q.order("outlier", { ascending: false, nullsFirst: false }).limit(300);
    filas = (data ?? []) as Fila[];
  }

  const pestaña = (v: string, t: string, n?: number) => (
    <Link
      href={v === "banco" ? "/hooks" : `/hooks?vista=${v}`}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${vista === v ? "bg-panel-2 text-texto" : "text-suave hover:text-texto"}`}
    >
      {t}
      {n !== undefined && <span className="ml-1.5 text-xs text-tenue">{n}</span>}
    </Link>
  );
  const chip = (href: string, on: boolean, t: string) => (
    <Link key={href} href={href} className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm ${on ? "border-acento/50 bg-acento/10 text-texto" : "border-borde text-suave hover:text-texto"}`}>
      {t}
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado titulo="Banco de hooks" bajada="Las primeras frases de los reels que mejor funcionaron. Solo se piden cuando vos querés.">
        {vista !== "pedir" && filas.length > 0 && (
          <CopiarHooks texto={filas.map((f) => `${textoHook(f)} — @${usuario.get(f.referente_id) ?? ""}`).join("\n")} />
        )}
      </Encabezado>
      <Aviso msg={uno(sp.msg) || undefined} error={uno(sp.error) || undefined} />
      <ProgresoSync />

      <nav aria-label="Vistas del banco de hooks" className="flex gap-1 border-b border-borde pb-2">
        {pestaña("banco", "Banco")}
        {pestaña("lista", "Mi lista", guardados.size)}
        {pestaña("pedir", "Pedir hooks")}
      </nav>

      {vista === "pedir" ? (
        <section className="max-w-2xl rounded-xl border border-borde bg-panel p-4 sm:p-5">
          <h2 className="mb-1 font-semibold">Pedir hooks</h2>
          <p className="mb-4 text-sm text-suave">
            Apify transcribe cada reel y guardamos la primera frase como hook. Cuesta ~US$ {PRECIO_TRANSCRIPCION} por reel, y se cobra solo una vez.
          </p>
          {referentes.length === 0 ? (
            <p className="text-sm text-suave">Primero agregá referentes.</p>
          ) : (
            <FormPedirHooks
              accion={pedirHooksAccion}
              referentes={referentes.map((r) => ({ id: r.id, usuario: r.ig_username, carpeta_id: r.carpeta_id }))}
              carpetas={carpetas}
              candidatos={candidatos}
              precio={PRECIO_TRANSCRIPCION}
            />
          )}
        </section>
      ) : (
        <>
          {vista === "banco" ? (
            <div className="flex flex-wrap gap-1">
              {chip("/hooks", !carpeta && !cuenta, "Todos")}
              {carpetas.map((c) => chip(`/hooks?carpeta=${c.id}`, carpeta === c.id, `📁 ${c.nombre}`))}
              <form action="/hooks" className="ml-auto">
                <select name="cuenta" defaultValue={cuenta} aria-label="Cuenta" className="h-9 rounded-md border border-borde bg-fondo px-2 text-sm text-suave">
                  <option value="">Todas las cuentas</option>
                  {referentes.map((r) => (
                    <option key={r.id} value={r.id}>
                      @{r.ig_username}
                    </option>
                  ))}
                </select>
                <button className="ml-1 h-9 rounded-md border border-borde px-3 text-sm text-suave hover:text-texto">Ver</button>
              </form>
            </div>
          ) : (
            carpetas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {chip("/hooks?vista=lista", !carpeta, "Todas")}
                {carpetas.map((c) => chip(`/hooks?vista=lista&carpeta=${c.id}`, carpeta === c.id, `📁 ${c.nombre}`))}
                {chip("/hooks?vista=lista&carpeta=sin", carpeta === "sin", "Sin carpeta")}
              </div>
            )
          )}

          {filas.length === 0 ? (
            vista === "lista" ? (
              <Vacio titulo="Tu lista está vacía" texto="En el Banco, tocá «Guardar en mi lista» en los hooks que quieras ir juntando." />
            ) : (
              <Vacio titulo="Todavía no hay hooks" texto="Andá a «Pedir hooks», elegí las cuentas y el período, y en unos minutos aparecen acá.">
                <Link href="/hooks?vista=pedir" className="mt-3 inline-flex h-9 items-center rounded-md bg-acento px-4 text-sm font-semibold text-black">
                  Pedir hooks
                </Link>
              </Vacio>
            )
          ) : (
            <ul className="flex flex-col gap-2">
              {filas.map((f) => {
                const enLista = guardados.has(f.id);
                return (
                  <li key={f.id} className="flex gap-3 rounded-xl border border-borde bg-panel p-3">
                    <Link href={`/p/${f.id}`} scroll={false} className="w-16 shrink-0 overflow-hidden rounded-lg bg-black sm:w-20" aria-label="Ver el reel">
                      <div className="aspect-[9/14]">
                        {f.miniatura_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.miniatura_url} alt="Portada (hook visual)" loading="lazy" className="size-full object-cover" />
                        )}
                      </div>
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="text-[15px] font-medium leading-snug text-texto">“{textoHook(f) || "Sin texto (reel sin voz)"}”</p>
                      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-suave">
                        <span>@{usuario.get(f.referente_id)}</span>
                        {f.outlier !== null && <span className={f.es_ganador ? "font-semibold text-acento" : ""}>{multiplicador(f.outlier)}</span>}
                        <span>{numero(f.vistas)} vistas</span>
                        <span>{numero(f.comentarios)} comentarios</span>
                        {f.formato_id !== null && <span>{formato.get(f.formato_id)}</span>}
                        <span className="text-tenue">{fechaCorta(f.fecha_publicacion)}</span>
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                        <BotonGuardarHook id={f.id} guardado={enLista} />
                        {enLista && vista === "lista" && carpetas.length > 0 && (
                          <SelectorCarpetaHook id={f.id} actual={guardados.get(f.id) ?? null} carpetas={carpetas} />
                        )}
                        <Link href={`/p/${f.id}`} scroll={false} className="text-xs text-suave hover:text-texto">
                          Ver reel →
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
