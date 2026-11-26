// Detecta reels que piden comentar una palabra clave ("Comentá INFO", 'Comenta "Catálogo"').
// Solo acepta la palabra si está en MAYÚSCULAS o entre comillas, para no confundir "comentá abajo".

const PATRON =
  /(?:coment[aáe]|escrib[ií]|escribime|dejame|dej[aá])\s+(?:la palabra\s+|abajo\s+)?(["“”«'‘’]?)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{2,24})\1?/gi;

export function detectarPalabraClave(caption: string | null | undefined): string | null {
  if (!caption) return null;
  for (const m of caption.matchAll(PATRON)) {
    const comillas = m[1];
    const palabra = m[2];
    const esMayuscula = palabra === palabra.toUpperCase() && /[A-ZÁÉÍÓÚÜÑ]/.test(palabra);
    if (comillas || esMayuscula) return palabra.toUpperCase();
  }
  return null;
}

export function detectarCta(caption: string | null | undefined): string | null {
  if (!caption) return null;
  if (detectarPalabraClave(caption)) return "comenta_palabra";
  const t = caption.toLowerCase();
  if (/link en (la )?bio|link en mi perfil/.test(t)) return "link_bio";
  if (/(mandame|escribime|envi[aá]me) (un )?(dm|md|mensaje)/.test(t)) return "dm";
  if (/seguime|segu[ií] (la cuenta|a @)/.test(t)) return "seguir";
  return null;
}
