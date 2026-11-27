import VistaPublicaciones from "@/components/VistaPublicaciones";

export const dynamic = "force-dynamic";

export default async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <VistaPublicaciones
      sp={await searchParams}
      tipo="todos"
      titulo="Contenido"
      bajada="Elegí un perfil o mirá todos juntos, ordenado por lo que mejor funcionó."
      porFormato={false}
    />
  );
}
