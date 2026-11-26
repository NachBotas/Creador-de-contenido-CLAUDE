import Link from "next/link";
import { listarFormatos, listarIdeas, listarReferentes } from "@/lib/datos";
import Encabezado, { Vacio } from "./Encabezado";
import Tarjeta from "./Tarjeta";
import DetallePublicacion from "./DetallePublicacion";
import { ControlModal } from "./Interactivos";

export default async function VistaIdeas({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const [ideas, referentes, formatos] = await Promise.all([listarIdeas(), listarReferentes(), listarFormatos()]);
  const refPorId = new Map(referentes.map((r) => [r.id, r]));
  const ver = typeof sp.ver === "string" ? sp.ver : "";
  const abierta = ideas.find((p) => p.id === ver);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado titulo="Banco de ideas" bajada={`Las referencias que guardaste · ${ideas.length}`}>
        {ideas.length > 0 && (
          <a href="/api/exportar?vista_de=ideas" className="flex h-9 items-center rounded-md border border-borde px-3 text-sm text-suave hover:bg-panel-2 hover:text-texto">
            Exportar a Excel
          </a>
        )}
      </Encabezado>
      {ideas.length === 0 ? (
        <Vacio titulo="Todavía no guardaste ideas" texto="Abrí cualquier reel o carrusel y tocá «Guardar idea» para tenerlo acá." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {ideas.map((p) => (
            <Tarjeta key={p.id} p={p} href={`?ver=${p.id}`} guardada referente={refPorId.get(p.referente_id)} formatos={formatos} mostrarFormato={false} />
          ))}
        </div>
      )}
      {abierta && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true" aria-label="Detalle de la publicación">
          <ControlModal hrefCerrar="/ideas" />
          <Link href="/ideas" scroll={false} aria-hidden="true" tabIndex={-1} className="fixed inset-0 cursor-default" />
          <div className="relative mx-auto max-w-6xl rounded-2xl border border-borde bg-panel p-4 shadow-2xl sm:p-6">
            <Link href="/ideas" scroll={false} aria-label="Cerrar" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full text-xl text-suave hover:bg-panel-2 hover:text-texto">
              ×
            </Link>
            <DetallePublicacion p={abierta} referente={refPorId.get(abierta.referente_id)} formatos={formatos} guardada />
          </div>
        </div>
      )}
    </div>
  );
}
