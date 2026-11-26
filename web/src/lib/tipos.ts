export type Formato = { id: number; nombre: string; descripcion: string | null; orden: number };

export type Referente = {
  id: string;
  ig_username: string;
  nombre: string | null;
  foto_url: string | null;
  seguidores: number | null;
  contenido_activo: boolean;
  historias_activo: boolean;
  ultima_sync: string | null;
  created_at: string;
};

export type Publicacion = {
  id: string;
  referente_id: string;
  ig_id: string;
  tipo: "reel" | "carrusel" | "imagen";
  url: string | null;
  caption: string | null;
  fecha_publicacion: string | null;
  vistas: number | null;
  likes: number | null;
  comentarios: number | null;
  duracion_seg: number | null;
  miniatura_url: string | null;
  media_url: string | null;
  slides: { url: string }[] | null;
  formato_id: number | null;
  hook: string | null;
  cta_tipo: string | null;
  palabra_clave: string | null;
  fijado: boolean;
  metrica: number | null;
  outlier: number | null;
  outlier_comentarios: number | null;
  tasa_comentarios: number | null;
  es_ganador: boolean;
};

export type Historia = {
  id: string;
  referente_id: string;
  ig_id: string;
  fecha_publicacion: string;
  tipo_media: "imagen" | "video" | null;
  media_url: string | null;
  miniatura_url: string | null;
  duracion_seg: number | null;
  stickers: { tipo: string; texto?: string | null; url?: string | null }[] | null;
  texto: string | null;
  categoria: string | null;
};
