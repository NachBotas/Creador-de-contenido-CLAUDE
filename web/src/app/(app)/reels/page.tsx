import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Ahora todo está en la pantalla Contenido.
export default async function Redireccion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
  p.set("t", "reel");
  redirect(`/?${p}`);
}
