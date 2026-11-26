-- 004 · Métricas de cuentas propias/clientes (Instagram oficial) y conversaciones de ManyChat

-- Cuentas de Instagram conectadas con el login oficial
create table if not exists public.cuentas_ig (
  id                uuid primary key default gen_random_uuid(),
  ig_user_id        text not null unique,
  username          text not null,
  nombre            text,
  foto_url          text,
  seguidores        bigint,
  seguidos          bigint,
  cantidad_posts    bigint,
  token_cifrado     text not null,              -- token de acceso, cifrado
  token_expira      timestamptz,
  ultima_sync       timestamptz,
  ultimo_error      text,
  created_at        timestamptz not null default now()
);

-- Una fila por cuenta y por día
create table if not exists public.metricas_diarias (
  cuenta_id          uuid not null references public.cuentas_ig(id) on delete cascade,
  fecha              date not null,
  seguidores         bigint,                     -- foto del total ese día (la guardamos nosotros)
  nuevos_seguidores  bigint,                     -- lo que informa Instagram
  alcance            bigint,
  primary key (cuenta_id, fecha)
);

-- Demografía de seguidores (se reemplaza en cada actualización)
create table if not exists public.demografia (
  cuenta_id    uuid not null references public.cuentas_ig(id) on delete cascade,
  dimension    text not null check (dimension in ('genero', 'edad', 'pais', 'ciudad')),
  clave        text not null,
  valor        bigint not null,
  actualizado  timestamptz not null default now(),
  primary key (cuenta_id, dimension, clave)
);

-- Publicaciones propias con métricas privadas (guardados, compartidos, alcance)
create table if not exists public.posts_propios (
  id              uuid primary key default gen_random_uuid(),
  cuenta_id       uuid not null references public.cuentas_ig(id) on delete cascade,
  ig_media_id     text not null unique,
  tipo            text,                          -- REELS, FEED, STORY / CAROUSEL_ALBUM, IMAGE, VIDEO
  permalink       text,
  caption         text,
  fecha           timestamptz,
  miniatura_url   text,
  likes           bigint,
  comentarios     bigint,
  alcance         bigint,
  vistas          bigint,
  guardados       bigint,
  compartidos     bigint,
  interacciones   bigint,
  updated_at      timestamptz not null default now()
);
create index if not exists posts_propios_cuenta_idx on public.posts_propios (cuenta_id, fecha desc);

-- ManyChat: una conexión por cuenta (o suelta) y los eventos que manda cada flow
create table if not exists public.manychat_conexiones (
  id              uuid primary key default gen_random_uuid(),
  cuenta_id       uuid references public.cuentas_ig(id) on delete set null,
  nombre_pagina   text,
  token_cifrado   text not null,
  secreto         text not null unique,          -- va en el header Authorization del flow
  created_at      timestamptz not null default now()
);

create table if not exists public.manychat_eventos (
  id              bigint generated always as identity primary key,
  conexion_id     uuid not null references public.manychat_conexiones(id) on delete cascade,
  etiqueta        text not null,
  subscriber_id   text not null,
  created_at      timestamptz not null default now(),
  unique (conexion_id, etiqueta, subscriber_id)  -- contamos personas, no mensajes
);
create index if not exists manychat_eventos_idx on public.manychat_eventos (conexion_id, created_at desc);

alter table public.cuentas_ig           enable row level security;
alter table public.metricas_diarias     enable row level security;
alter table public.demografia           enable row level security;
alter table public.posts_propios        enable row level security;
alter table public.manychat_conexiones  enable row level security;
alter table public.manychat_eventos     enable row level security;

grant select, insert, update, delete on public.cuentas_ig, public.metricas_diarias, public.demografia,
  public.posts_propios, public.manychat_conexiones, public.manychat_eventos to service_role;
grant usage, select on all sequences in schema public to service_role;
