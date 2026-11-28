import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { itemsDelDataset, procesarDetalles, procesarHistorias, procesarPosts, procesarTranscripciones } from "@/lib/apify";
import { subirHistoriasPendientes } from "@/lib/drive";
import { db } from "@/lib/supabase";

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
  const cuerpo = (await req.json().catch(() => null)) as { resource?: { id?: string; defaultDatasetId?: string; status?: string } } | null;
  const runId = cuerpo?.resource?.id;
  const marcar = (cambios: Record<string, unknown>) =>
    runId ? db().from("sincronizaciones").update(cambios).eq("run_id", runId).then(() => undefined, () => undefined) : Promise.resolve();
  if (url.searchParams.get("fallo")) {
    await marcar({ estado: "error", mensaje: `Apify: ${cuerpo?.resource?.status ?? "falló"}`, terminado_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }
  const datasetId = cuerpo?.resource?.defaultDatasetId;
  if (!datasetId) return NextResponse.json({ error: "Falta el dataset" }, { status: 400 });
  await marcar({ estado: "guardando" });

  try {
    const items = await itemsDelDataset(datasetId);
    let guardados = 0;
    if (tipo === "detalles") await procesarDetalles(items);
    else if (tipo === "posts") guardados = await procesarPosts(items);
    else if (tipo === "historias") {
      guardados = await procesarHistorias(items);
      await subirHistoriasPendientes(150_000).catch(() => undefined);
    }
    else if (tipo === "transcripciones") guardados = await procesarTranscripciones(items);
    else return NextResponse.json({ error: "Tipo desconocido" }, { status: 400 });
    // Recalcular outlier y ganadores con los números nuevos
    if (tipo === "posts" || tipo === "detalles") await db().rpc("recalcular_scores").then(() => undefined, () => undefined);
    await marcar({ estado: "listo", guardados: tipo === "detalles" ? items.length : guardados, terminado_at: new Date().toISOString() });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, tipo, guardados });
  } catch (e) {
    await marcar({ estado: "error", mensaje: (e as Error).message.slice(0, 300), terminado_at: new Date().toISOString() });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
