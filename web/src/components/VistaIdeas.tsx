import Link from "next/link";
import { carpetasDeIdeas, listarCarpetas, listarFormatos, listarIdeas, listarReferentes } from "@/lib/datos";
import Encabezado, { Vacio } from "./Encabezado";
import Tarjeta from "./Tarjeta";
import SelectorCarpeta from "./SelectorCarpeta";

export default async function VistaIdeas({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const carpeta = typeof sp.carpeta === "string" ? sp.carpeta : "";
  const [ideas, referentes, formatos, carpetas, carpetaDe] = await Promise.all([
    listarIdeas(carpeta),
    listarReferentes(),
    listarFormatos(),
    listarCarpetas(),
    carpetasDeIdeas(),
  ]);
  const refPorId = new Map(referentes.map((r) => [r.id, r]));
  const conteo = (id: string) => [...carpetaDe.values()].filter((c) => (id === "sin" ? c === null : id ? c === id : true)).length;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Encabezado titulo="Banco de ideas" bajada={`Las referencias que guardaste · ${carpetaDe.size}`}>
        {ideas.length > 0 && (
          <a href="/api/exportar?vista_de=ideas" className="flex h-9 items-center rounded-md border border-borde px-3 text-sm text-suave hover:bg-panel-2 hover:text-texto">
            Exportar a Excel
          </a>
        )}
      </Encabezado>

      {carpetas.length > 0 && (
        <nav aria-label="Carpetas" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {[{ id: "", nombre: "Todas" }, ...carpetas, { id: "sin", nombre: "Sin carpeta" }].map((c) => (
            <Link
              key={c.id || "todas"}
              href={c.id ? `/ideas?carpeta=${c.id}` : "/ideas"}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm ${carpeta === c.id ? "border-acento/50 bg-acento/10 text-texto" : "border-borde text-suave hover:text-texto"}`}
            >
              {c.id && c.id !== "sin" ? `📁 ${c.nombre}` : c.nombre} <span className="ml-1 text-xs text-tenue">{conteo(c.id)}</span>
            </Link>
          ))}
        </nav>
      )}

      {ideas.length === 0 ? (
        <Vacio
          titulo={carpeta ? "No hay ideas en esta carpeta" : "Todavía no guardaste ideas"}
          texto="Abrí cualquier reel o carrusel y tocá «Guardar idea». Se guarda en la carpeta del referente y la podés mover desde acá."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {ideas.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <Tarjeta p={p} href={`/p/${p.id}`} guardada referente={refPorId.get(p.referente_id)} formatos={formatos} mostrarFormato={false} />
              {carpetas.length > 0 && <SelectorCarpeta id={p.id} actual={carpetaDe.get(p.id) ?? null} carpetas={carpetas} de="idea" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
