// Instagram a veces entrega el reel en formato DASH: el video sin audio y el audio en otro archivo.
// Lo detectamos por la etiqueta de codificación que viaja dentro del link (parámetro "efg").
export function videoSinAudio(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const efg = new URL(url).searchParams.get("efg");
    if (!efg) return false;
    const b64 = efg.replace(/-/g, "+").replace(/_/g, "/");
    const tag = String(JSON.parse(atob(b64 + "===".slice((b64.length + 3) % 4))).vencode_tag ?? "");
    return tag.includes("xpvds") && !tag.includes("progressive") && !tag.includes("audio");
  } catch {
    return false;
  }
}
