import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { itemsDelDataset, procesarDetalles, procesarHistorias, procesarPosts } from "@/lib/apify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Apify avisa acá cuando termina una corrida. Leemos sus resultados y los guardamos.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secreto = process.env.CRON_SECRET;
  if (!secreto || url.searchParams.get("token") !== secreto) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const tipo = url.searchParams.get("tipo");
  const cuerpo = (await req.json().catch(() => null)) as { resource?: { defaultDatasetId?: string } } | null;
  const datasetId = cuerpo?.resource?.defaultDatasetId;
  if (!datasetId) return NextResponse.json({ error: "Falta el dataset" }, { status: 400 });

  try {
    const items = await itemsDelDataset(datasetId);
    let guardados = 0;
    if (tipo === "detalles") await procesarDetalles(items);
    else if (tipo === "posts") guardados = await procesarPosts(items);
    else if (tipo === "historias") guardados = await procesarHistorias(items);
    else return NextResponse.json({ error: "Tipo desconocido" }, { status: 400 });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, tipo, guardados });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
