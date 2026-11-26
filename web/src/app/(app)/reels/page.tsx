import VistaPublicaciones from "@/components/VistaPublicaciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reels · Radar de contenido" };

export default async function Reels({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <VistaPublicaciones
      sp={await searchParams}
      tipo="reel"
      titulo="Reels"
      bajada="Separados por formato. Asigná el formato de cada reel desde su tarjeta."
      porFormato
    />
  );
}
