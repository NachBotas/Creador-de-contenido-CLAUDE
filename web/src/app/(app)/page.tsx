import VistaPublicaciones from "@/components/VistaPublicaciones";

export const dynamic = "force-dynamic";

export default async function FeedViral({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <VistaPublicaciones
      sp={await searchParams}
      tipo="todos"
      titulo="Feed viral"
      bajada="Lo que mejor funcionó entre todos tus referentes, ordenado por outlier."
      porFormato={false}
    />
  );
}
