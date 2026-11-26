-- =====================================================================
-- 001 · Estructura inicial de la base de contenido
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================

-- ---------- Formatos de Reels (se pueden agregar más cuando quieras) ----------
create table if not exists public.formatos (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  descripcion text,
  orden       int  not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.formatos (nombre, orden) values
  ('Talking Head', 1),
  ('Miro', 2),
  ('Clip', 3)
on conflict (nombre) do nothing;

-- ---------- Referentes (cuentas que seguimos) ----------
create table if not exists public.referentes (
  id                uuid primary key default gen_random_uuid(),
  ig_username       text not null unique,
  ig_user_id        text,
  nombre            text,
  foto_url          text,
  seguidores        bigint,
  contenido_activo  boolean not null default true,   -- scrapear reels y carruseles
  historias_activo  boolean not null default true,   -- scrapear historias
  ultima_sync       timestamptz,
  created_at        timestamptz not null default now()
);

-- ---------- Publicaciones: reels, carruseles e imágenes ----------
create table if not exists public.publicaciones (
  id                 uuid primary key default gen_random_uuid(),
  referente_id       uuid not null references public.referentes(id) on delete cascade,
  ig_id              text not null unique,            -- shortcode de Instagram
  tipo               text not null check (tipo in ('reel', 'carrusel', 'imagen')),
  url                text,
  caption            text,
  fecha_publicacion  timestamptz,
  vistas             bigint,                          -- solo reels (dato público)
  likes              bigint,
  comentarios        bigint,
  duracion_seg       numeric,
  miniatura_url      text,
  media_url          text,
  slides             jsonb,                           -- carruseles: imágenes y texto de cada slide
  -- Lo que completa la IA
  formato_id         bigint references public.formatos(id) on delete set null,
  hook               text,
  transcripcion      text,
  cta_tipo           text,                            -- comenta_palabra, link_bio, dm, seguir, ninguno
  palabra_clave      text,                            -- si pide "comentá X"
  analisis           jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists publicaciones_referente_idx on public.publicaciones (referente_id, tipo, fecha_publicacion desc);
create index if not exists publicaciones_formato_idx   on public.publicaciones (formato_id);

-- ---------- Historias ----------
create table if not exists public.historias (
  id                 uuid primary key default gen_random_uuid(),
  referente_id       uuid not null references public.referentes(id) on delete cascade,
  ig_id              text not null unique,
  fecha_publicacion  timestamptz not null,
  tipo_media         text check (tipo_media in ('imagen', 'video')),
  media_url          text,                            -- copia guardada (las historias vencen a las 24 h)
  miniatura_url      text,
  duracion_seg       numeric,
  stickers           jsonb,                           -- link, encuesta, caja de preguntas, menciones
  -- Lo que completa la IA
  texto              text,                            -- texto que aparece en la historia
  categoria          text,                            -- venta, valor, prueba_social, interaccion, personal
  analisis           jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists historias_referente_idx on public.historias (referente_id, fecha_publicacion desc);

-- ---------- Comentarios (para segmentar y analizar) ----------
create table if not exists public.comentarios (
  id               uuid primary key default gen_random_uuid(),
  publicacion_id   uuid not null references public.publicaciones(id) on delete cascade,
  ig_id            text not null unique,
  usuario          text,
  texto            text,
  likes            bigint,
  fecha            timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists comentarios_publicacion_idx on public.comentarios (publicacion_id);

-- ---------- updated_at automático ----------
create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists publicaciones_updated_at on public.publicaciones;
create trigger publicaciones_updated_at before update on public.publicaciones
  for each row execute function public.tocar_updated_at();

-- ---------- Vista con scores: outlier y comentarios ----------
-- Métrica principal: vistas en reels, likes en carruseles/imágenes (sus vistas no son públicas).
-- Outlier = métrica del post / mediana de la cuenta (mismo tipo, últimos 120 días).
create or replace view public.publicaciones_con_score
with (security_invoker = true) as
with base as (
  select p.*,
         case when p.tipo = 'reel' then p.vistas else p.likes end as metrica
  from public.publicaciones p
),
medianas as (
  select referente_id, tipo,
         percentile_cont(0.5) within group (order by metrica)     as mediana_metrica,
         percentile_cont(0.5) within group (order by comentarios) as mediana_comentarios
  from base
  where metrica > 0
    and fecha_publicacion > now() - interval '120 days'
  group by referente_id, tipo
)
select b.*,
       round((b.metrica / nullif(m.mediana_metrica, 0))::numeric, 2)          as outlier,
       round((b.comentarios / nullif(m.mediana_comentarios, 0))::numeric, 2)  as outlier_comentarios,
       round((b.comentarios::numeric / nullif(b.metrica, 0)) * 100, 3)        as tasa_comentarios,
       coalesce(b.metrica / nullif(m.mediana_metrica, 0) >= 2, false)         as es_ganador
from base b
left join medianas m on m.referente_id = b.referente_id and m.tipo = b.tipo;

-- ---------- Seguridad ----------
-- RLS activado y sin políticas públicas: solo el servidor de la app (clave secreta) puede leer y escribir.
alter table public.formatos      enable row level security;
alter table public.referentes    enable row level security;
alter table public.publicaciones enable row level security;
alter table public.historias     enable row level security;
alter table public.comentarios   enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------- Almacenamiento de imágenes y videos de historias ----------
insert into storage.buckets (id, name, public)
values ('medios', 'medios', true)
on conflict (id) do nothing;
