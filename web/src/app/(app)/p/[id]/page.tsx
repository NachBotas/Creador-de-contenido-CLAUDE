import Link from "next/link";
import { notFound } from "next/navigation";
import { comentariosDe, listarFormatos, listarReferentes, obtenerPublicacion } from "@/lib/datos";
import { fechaCorta, multiplicador, numero } from "@/lib/formato";
import SelectorFormato from "@/components/SelectorFormato";

export const dynamic = "force-dynamic";

export default async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await obtenerPublicacion(id);
  if (!p) notFound();
  const [comentarios, formatos, referentes] = await Promise.all([comentariosDe(p.id), listarFormatos(), listarReferentes()]);
  const ref = referentes.find((r) => r.id === p.referente_id);
  const volver = p.tipo === "reel" ? "/reels" : p.tipo === "carrusel" ? "/carruseles" : "/";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href={volver} className="text-sm text-suave hover:text-texto">
        ← Volver
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-borde bg-black">
            {p.tipo === "carrusel" && p.slides?.length ? (
              <div className="flex snap-x snap-mandatory overflow-x-auto">
                {[{ url: p.miniatura_url ?? "" }, ...p.slides.slice(1)].map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={s.url} alt={`Slide ${i + 1}`} className="aspect-[4/5] w-full shrink-0 snap-center object-cover" />
                ))}
              </div>
            ) : p.miniatura_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.miniatura_url} alt="" className="w-full object-cover" />
            ) : (
              <div className="grid aspect-[9/16] place-items-center text-sm text-tenue">Sin imagen</div>
            )}
          </div>
          {p.tipo === "carrusel" && p.slides && p.slides.length > 1 && (
            <p className="text-center text-xs text-tenue">{p.slides.length} slides · deslizá para verlos</p>
          )}
          {p.url && (
            <a href={p.url} target="_blank" rel="noreferrer" className="rounded-lg border border-borde px-4 py-2 text-center text-sm hover:bg-panel">
              Abrir en Instagram ↗
            </a>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs text-suave">
              {ref ? `@${ref.ig_username}` : ""} · {p.tipo} · {fechaCorta(p.fecha_publicacion)}
              {p.fijado ? " · fijado" : ""}
            </p>
            {p.palabra_clave && (
              <p className="mt-2 w-fit rounded-md bg-acento/15 px-2 py-1 text-sm font-semibold text-acento">Pide comentar: {p.palabra_clave}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metrica titulo="Outlier" valor={multiplicador(p.outlier)} destacado={p.es_ganador} nota="frente a la mediana de la cuenta" />
            <Metrica titulo="Outlier de comentarios" valor={multiplicador(p.outlier_comentarios)} />
            <Metrica titulo="% de comentarios" valor={p.tasa_comentarios !== null ? `${p.tasa_comentarios.toFixed(2)}%` : "—"} />
            {p.tipo === "reel" && <Metrica titulo="Reproducciones" valor={numero(p.vistas)} />}
            <Metrica titulo="Me gusta" valor={numero(p.likes)} />
            <Metrica titulo="Comentarios" valor={numero(p.comentarios)} />
          </div>

          {p.tipo === "reel" && (
            <label className="flex max-w-xs flex-col gap-1.5 text-xs text-suave">
              Formato
              <SelectorFormato id={p.id} actual={p.formato_id} formatos={formatos} />
            </label>
          )}

          <section>
            <h2 className="mb-2 text-sm font-medium">Descripción</h2>
            <p className="whitespace-pre-wrap rounded-xl border border-borde bg-panel p-4 text-sm leading-relaxed text-suave">
              {p.caption || "Sin descripción."}
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium">
              Comentarios destacados <span className="text-xs text-tenue">({comentarios.length})</span>
            </h2>
            {comentarios.length ? (
              <ul className="flex flex-col divide-y divide-borde rounded-xl border border-borde bg-panel">
                {comentarios.map((c) => (
                  <li key={c.id} className="px-4 py-3 text-sm">
                    <span className="text-xs text-tenue">@{c.usuario}</span>
                    <p className="mt-0.5">{c.texto}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-tenue">Todavía no hay comentarios guardados de esta publicación.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metrica({ titulo, valor, nota, destacado }: { titulo: string; valor: string; nota?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${destacado ? "border-ganador/50 bg-ganador/10" : "border-borde bg-panel"}`}>
      <p className="text-xs text-suave">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="mt-0.5 text-[11px] text-tenue">{nota}</p>}
    </div>
  );
}
