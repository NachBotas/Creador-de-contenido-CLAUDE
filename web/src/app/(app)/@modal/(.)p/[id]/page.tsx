import { notFound } from "next/navigation";
import { idsGuardados, listarFormatos, listarReferentes, obtenerPublicacion } from "@/lib/datos";
import DetallePublicacion from "@/components/DetallePublicacion";
import ModalRuta from "@/components/ModalRuta";

export const dynamic = "force-dynamic";

// Se abre por encima de la grilla sin volver a cargarla (ruta interceptada).
export default async function ModalPublicacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [p, formatos, referentes, guardadas] = await Promise.all([obtenerPublicacion(id), listarFormatos(), listarReferentes(), idsGuardados()]);
  if (!p) notFound();
  return (
    <ModalRuta>
      <DetallePublicacion p={p} referente={referentes.find((r) => r.id === p.referente_id)} formatos={formatos} guardada={guardadas.has(p.id)} />
    </ModalRuta>
  );
}
