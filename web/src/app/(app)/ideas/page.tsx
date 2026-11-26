import VistaIdeas from "@/components/VistaIdeas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banco de ideas · Radar de contenido" };

export default async function Ideas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <VistaIdeas sp={await searchParams} />;
}
