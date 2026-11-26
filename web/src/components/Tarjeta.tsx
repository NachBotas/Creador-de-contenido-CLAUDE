import Link from "next/link";
import type { Formato, Publicacion, Referente } from "@/lib/tipos";
import { fechaCorta, multiplicador, numero } from "@/lib/formato";
import SelectorFormato from "./SelectorFormato";

const ETIQUETA_TIPO = { reel: "Reel", carrusel: "Carrusel", imagen: "Imagen" } as const;

export default function Tarjeta({
  p,
  referente,
  formatos,
  mostrarFormato,
  href,
  guardada,
}: {
  href: string;
  guardada?: boolean;
  p: Publicacion;
  referente?: Referente;
  formatos: Formato[];
  mostrarFormato: boolean;
}) {
  const esReel = p.tipo === "reel";
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-borde bg-panel transition hover:border-suave/40">
      <Link href={href} scroll={false} className="relative block bg-black" aria-label={`Ver detalle: ${p.caption?.slice(0, 60) ?? "publicación"}`}>
        <div className={esReel ? "aspect-[9/14]" : "aspect-[4/5]"}>
          {p.miniatura_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.miniatura_url} alt="" loading="lazy" className="size-full object-cover transition group-hover:opacity-90" />
          ) : (
            <div className="grid size-full place-items-center text-xs text-tenue">Sin imagen</div>
          )}
        </div>
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {ETIQUETA_TIPO[p.tipo]}
          {p.tipo === "carrusel" && p.slides?.length ? ` · ${p.slides.length}` : ""}
        </span>
        {p.outlier !== null && (
          <span
            className={`absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
              p.es_ganador ? "bg-ganador text-black" : "bg-black/70 text-white"
            }`}
            title="Rendimiento frente a la mediana de la cuenta"
          >
            {multiplicador(p.outlier)}
          </span>
        )}
        {guardada && (
          <span className="absolute bottom-2 right-2 rounded-md bg-acento px-1.5 py-0.5 text-[10px] font-semibold text-black">Guardada</span>
        )}
        {p.fijado && <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Fijado</span>}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {referente && (
          <div className="flex items-center gap-1.5 text-[11px] text-suave">
            {referente.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={referente.foto_url} alt="" className="size-4 rounded-full object-cover" />
            ) : null}
            <span className="truncate">@{referente.ig_username}</span>
            <span className="ml-auto shrink-0 text-tenue">{fechaCorta(p.fecha_publicacion)}</span>
          </div>
        )}
        <p className="line-clamp-2 text-sm leading-snug">{p.caption || <span className="text-tenue">Sin texto</span>}</p>
        {p.palabra_clave && (
          <span className="w-fit rounded-md bg-acento/15 px-1.5 py-0.5 text-[11px] font-semibold text-acento">Comentá {p.palabra_clave}</span>
        )}
        <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] tabular-nums text-suave">
          {esReel && <Dato icono="▶" valor={numero(p.vistas)} titulo="Reproducciones" />}
          <Dato icono="♥" valor={numero(p.likes)} titulo="Me gusta" />
          <Dato icono="💬" valor={numero(p.comentarios)} titulo="Comentarios" />
          {p.tasa_comentarios !== null && (
            <span className="ml-auto text-tenue" title="Comentarios cada 100 vistas (o likes en carruseles)">
              {p.tasa_comentarios.toFixed(2)}%
            </span>
          )}
        </div>
        {mostrarFormato && esReel && <SelectorFormato id={p.id} actual={p.formato_id} formatos={formatos} />}
      </div>
    </article>
  );
}

function Dato({ icono, valor, titulo }: { icono: string; valor: string; titulo: string }) {
  return (
    <span title={titulo} className="flex items-center gap-1">
      <span aria-hidden="true" className="text-[10px] text-tenue">
        {icono}
      </span>
      <span className="sr-only">{titulo}:</span>
      {valor}
    </span>
  );
}
