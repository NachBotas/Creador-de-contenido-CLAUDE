import VistaPublicaciones from "@/components/VistaPublicaciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carruseles · Radar de contenido" };

export default async function Carruseles({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <VistaPublicaciones
      sp={await searchParams}
      tipo="carrusel"
      titulo="Carruseles"
      bajada="El outlier de los carruseles se calcula con likes, porque sus vistas no son públicas."
      porFormato={false}
    />
  );
}
