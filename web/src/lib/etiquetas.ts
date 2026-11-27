// Lee las etiquetas de ManyChat (HR, reel, carrusel, historia, saludo…) y saca tipo y fecha del nombre.

export type TipoEtiqueta = "hr" | "reel" | "carrusel" | "historia" | "saludo" | "otro";

export const TIPOS: Record<TipoEtiqueta, { nombre: string; color: string }> = {
  hr: { nombre: "Hand raiser", color: "#f5b83d" },
  reel: { nombre: "Reel", color: "#c6f432" },
  carrusel: { nombre: "Carrusel", color: "#5ec8f2" },
  historia: { nombre: "Historia", color: "#c084fc" },
  saludo: { nombre: "Saludo a seguidores", color: "#f472b6" },
  otro: { nombre: "Otra", color: "#9aa1ad" },
};

export function tipoEtiqueta(nombre: string): TipoEtiqueta {
  const t = nombre.toLowerCase();
  if (/(^|[^a-z])hr([^a-z]|$)|hand ?raiser/.test(t)) return "hr";
  if (/reel/.test(t)) return "reel";
  if (/carru|carousel/.test(t)) return "carrusel";
  if (/histori|story|stories/.test(t)) return "historia";
  if (/salud|bienven|welcome|seguidor/.test(t)) return "saludo";
  return "otro";
}

// Acepta 26/11, 26-11-26, 26.11.2026, 2026-11-26, 261126 y 26112026.
export function fechaEtiqueta(nombre: string, hoy = new Date()): Date | null {
  const iso = nombre.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return armar(+iso[3], +iso[2], +iso[1], hoy);
  const dmy = nombre.match(/(?:^|\D)(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?(?:\D|$)/);
  if (dmy) return armar(+dmy[1], +dmy[2], dmy[3] ? +dmy[3] : null, hoy);
  const junto = nombre.match(/(?:^|\D)(\d{2})(\d{2})(\d{2}|20\d{2})(?:\D|$)/);
  if (junto) return armar(+junto[1], +junto[2], +junto[3], hoy);
  return null;
}

function armar(dia: number, mes: number, anio: number | null, hoy: Date): Date | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  let a = anio === null ? hoy.getFullYear() : anio < 100 ? 2000 + anio : anio;
  let f = new Date(Date.UTC(a, mes - 1, dia, 12));
  // Sin año y en el futuro: es del año pasado
  if (anio === null && f.getTime() > hoy.getTime() + 2 * 86_400_000) {
    a -= 1;
    f = new Date(Date.UTC(a, mes - 1, dia, 12));
  }
  return f.getUTCDate() === dia ? f : null;
}

export type Paso = { nombre: string; tipo: TipoEtiqueta; fecha: Date | null };

// El recorrido de una persona: etiquetas ordenadas por fecha (las que no tienen fecha van al final).
export function recorrido(etiquetas: { name: string }[]): Paso[] {
  return etiquetas
    .map((e) => ({ nombre: e.name, tipo: tipoEtiqueta(e.name), fecha: fechaEtiqueta(e.name) }))
    .sort((a, b) => {
      if (a.fecha && b.fecha) return a.fecha.getTime() - b.fecha.getTime();
      if (a.fecha) return -1;
      if (b.fecha) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
}

// Origen = primer contenido (que no sea "otra") en el recorrido.
export function origen(pasos: Paso[]): Paso | null {
  return pasos.find((p) => p.tipo !== "otro") ?? pasos[0] ?? null;
}

// Último contenido antes del cierre (o el último si no hay fecha de cierre).
export function ultimoToque(pasos: Paso[], cierre: Date | null): Paso | null {
  const relevantes = pasos.filter((p) => p.tipo !== "otro" && (!cierre || !p.fecha || p.fecha.getTime() <= cierre.getTime()));
  return relevantes.at(-1) ?? null;
}
