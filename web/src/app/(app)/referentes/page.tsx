import { mudarImagenesAccion } from "@/app/acciones";
import { r2Configurado } from "@/lib/almacen";
import { db } from "@/lib/supabase";
import { agregarFormato, agregarReferente, completarPortadasAccion, guardarAjusteSync, sincronizar } from "@/app/acciones";
import { leerSyncDiaria, pendientesDePortada } from "@/lib/apify";
import FormSync from "@/components/FormSync";
import { conteosPorReferente, listarFormatos, listarReferentes } from "@/lib/datos";
import { fechaHora, numero } from "@/lib/formato";
import Encabezado, { Aviso, Vacio } from "@/components/Encabezado";
import { BotonEliminar, BotonEliminarFormato, Interruptor } from "@/components/ControlesReferente";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "Referentes · Radar de contenido" };

export default async function Referentes({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string; sync?: string }> }) {
  const { msg, error, sync } = await searchParams;
  const [referentes, formatos, conteos, diaria, sinPortada] = await Promise.all([listarReferentes(), listarFormatos(), conteosPorReferente(), leerSyncDiaria(), pendientesDePortada()]);
  const pendientesR2 = r2Configurado()
    ? (
        await Promise.all(
          [
            ["publicaciones", "miniatura_url"],
            ["historias", "miniatura_url"],
            ["referentes", "foto_url"],
          ].map(([t, c]) => db().from(t).select("id", { count: "exact", head: true }).like(c, "%supabase.co/storage%")),
        )
      ).reduce((s, r) => s + (r.count ?? 0), 0)
    : 0;
  const refsSync = referentes.map((r) => ({ id: r.id, usuario: r.ig_username, contenido: r.contenido_activo, historias: r.historias_activo }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado titulo="Referentes" bajada="Las cuentas que seguís. Se actualizan solas una vez por día.">
        {referentes.length > 0 && (
          <a href="#sincronizar" className="flex h-9 items-center rounded-lg border border-borde px-3 text-sm hover:bg-panel">
            Sincronizar…
          </a>
        )}
      </Encabezado>

      <Aviso msg={msg} error={error} />

      <form action={agregarReferente} className="flex flex-wrap gap-2 rounded-xl border border-borde bg-panel p-3">
        <label htmlFor="usuario" className="sr-only">
          Usuario o link del perfil
        </label>
        <input
          id="usuario"
          name="usuario"
          required
          placeholder="@usuario o link del perfil de Instagram"
          className="h-10 min-w-0 flex-1 basis-60 rounded-md border border-borde bg-fondo px-3 text-sm outline-none focus:border-acento"
        />
        <button className="h-10 rounded-md bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc">Agregar referente</button>
      </form>

      {referentes.length === 0 ? (
        <Vacio titulo="Todavía no seguís a nadie" texto="Agregá la primera cuenta arriba. Vamos a traer sus reels, carruseles e historias." />
      ) : (
        <ul className="flex flex-col divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-panel">
          {referentes.map((r) => {
            const c = conteos.get(r.id) ?? { publicaciones: 0, historias: 0 };
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {r.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.foto_url} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full bg-panel-2 text-sm text-suave">{r.ig_username[0]?.toUpperCase()}</span>
                )}
                <div className="min-w-0 flex-1">
                  <a href={`https://www.instagram.com/${r.ig_username}/`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    @{r.ig_username}
                  </a>
                  <p className="text-xs text-suave">
                    {r.seguidores !== null ? `${numero(r.seguidores)} seguidores · ` : ""}
                    {c.publicaciones} publicaciones · {c.historias} historias · actualizado {fechaHora(r.ultima_sync)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Interruptor id={r.id} campo="contenido_activo" valor={r.contenido_activo} texto="Contenido" />
                  <Interruptor id={r.id} campo="historias_activo" valor={r.historias_activo} texto="Historias" />
                  <a href={`?sync=${r.id}#sincronizar`} className="rounded-md px-2 py-1 text-xs text-suave hover:bg-panel-2 hover:text-texto">
                    Sincronizar
                  </a>
                  <BotonEliminar id={r.id} usuario={r.ig_username} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {r2Configurado() && pendientesR2 > 0 && (
        <form action={mudarImagenesAccion} className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-panel p-4">
          <p className="min-w-0 flex-1 text-sm">
            <strong>Mudanza a Cloudflare: faltan {pendientesR2} imágenes.</strong>{" "}
            <span className="text-suave">Las nuevas ya se guardan ahí. Las viejas se mudan solas cada mañana, o ahora con el botón.</span>
          </p>
          <button className="h-9 rounded-lg border border-borde px-3 text-sm hover:bg-panel-2">Mudar ahora</button>
        </form>
      )}

      {sinPortada.length > 0 && (
        <form action={completarPortadasAccion} className="flex flex-wrap items-center gap-3 rounded-xl border border-ganador/40 bg-ganador/10 p-4">
          <p className="min-w-0 flex-1 text-sm">
            <strong>{sinPortada.length} ganadores sin portada ni texto</strong> (importados antes). Se completan solos cada mañana, de a 40.
            <span className="block text-xs text-suave">Ahora: hasta 60 por vez, ~US$ {(Math.min(sinPortada.length, 60) * 0.0027).toFixed(2)} de Apify.</span>
          </p>
          <button className="h-9 rounded-lg bg-acento px-4 text-sm font-semibold text-black hover:bg-acento-osc">Completar ahora</button>
        </form>
      )}

      {referentes.length > 0 && (
        <div id="sincronizar" className="grid scroll-mt-6 gap-4 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-xl border border-borde bg-panel p-5">
            <div>
              <h2 className="font-medium">Sincronizar ahora</h2>
              <p className="text-sm text-suave">Elegí qué traer, de qué cuentas y cuánto hacia atrás.</p>
            </div>
            <FormSync
              key={sync ?? "todas"}
              accion={sincronizar}
              referentes={refsSync}
              modo="ahora"
              inicial={{ feed: true, historias: true, dias: 30, maximo: 30 }}
              cuentaInicial={referentes.some((r) => r.id === sync) ? sync : ""}
            />
          </section>
          <section className="flex flex-col gap-3 rounded-xl border border-borde bg-panel p-5">
            <div>
              <h2 className="font-medium">Sincronización automática</h2>
              <p className="text-sm text-suave">Corre sola todos los días a las 6 de la mañana. Elegí qué traer y de qué cuentas.</p>
            </div>
            <FormSync accion={guardarAjusteSync} referentes={refsSync} modo="diaria" inicial={diaria} />
          </section>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Formatos de Reels</h2>
          <p className="text-sm text-suave">Las columnas en las que se separan tus reels. Agregá todos los que uses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {formatos.map((f) => (
            <span key={f.id} className="flex items-center rounded-lg border border-borde bg-panel px-3 py-1.5 text-sm">
              {f.nombre}
              <BotonEliminarFormato id={f.id} nombre={f.nombre} />
            </span>
          ))}
        </div>
        <form action={agregarFormato} className="flex max-w-md gap-2">
          <label htmlFor="nombre-formato" className="sr-only">
            Nombre del formato
          </label>
          <input
            id="nombre-formato"
            name="nombre"
            required
            maxLength={40}
            placeholder="Ej: Voz en off, Tutorial, Meme…"
            className="h-10 min-w-0 flex-1 rounded-md border border-borde bg-fondo px-3 text-sm outline-none focus:border-acento"
          />
          <button className="h-10 rounded-md border border-borde px-4 text-sm hover:bg-panel">Agregar</button>
        </form>
      </section>
    </div>
  );
}
