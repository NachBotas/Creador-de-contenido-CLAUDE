import Link from "next/link";
import { notFound } from "next/navigation";
import { idsGuardados, listarFormatos, listarReferentes, obtenerPublicacion } from "@/lib/datos";
import DetallePublicacion from "@/components/DetallePublicacion";

export const dynamic = "force-dynamic";

export default async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await obtenerPublicacion(id);
  if (!p) notFound();
  const [formatos, referentes, guardadas] = await Promise.all([listarFormatos(), listarReferentes(), idsGuardados()]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href={p.tipo === "reel" ? "/reels" : "/carruseles"} className="text-sm text-suave hover:text-texto">
        ← Volver
      </Link>
      <div className="rounded-2xl border border-borde bg-panel p-4 sm:p-6">
        <DetallePublicacion p={p} referente={referentes.find((r) => r.id === p.referente_id)} formatos={formatos} guardada={guardadas.has(p.id)} />
      </div>
    </div>
  );
}
