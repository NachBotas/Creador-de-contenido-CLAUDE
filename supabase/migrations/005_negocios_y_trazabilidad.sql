-- 005 · Negocios (hasta 5, cada uno con su ManyChat) y trazabilidad de contactos

create table if not exists public.negocios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  ig_username  text,
  orden        int not null default 0,
  created_at   timestamptz not null default now()
);

-- Cada negocio tiene su propia cuenta de ManyChat
alter table public.manychat_conexiones add column if not exists negocio_id uuid references public.negocios(id) on delete cascade;
create unique index if not exists manychat_conexiones_negocio_uidx on public.manychat_conexiones (negocio_id) where negocio_id is not null;

-- Para cuando se retomen las Métricas: cada Instagram conectado pertenece a un negocio
alter table public.cuentas_ig add column if not exists negocio_id uuid references public.negocios(id) on delete set null;

-- Personas buscadas en ManyChat: su ficha, sus etiquetas y si cerraron
create table if not exists public.contactos (
  id                  uuid primary key default gen_random_uuid(),
  negocio_id          uuid not null references public.negocios(id) on delete cascade,
  subscriber_id       text not null,
  nombre              text,
  ig_username         text,
  foto_url            text,
  email               text,
  telefono            text,
  etiquetas           jsonb not null default '[]',   -- [{id, name}] tal cual las devuelve ManyChat
  suscripto_en        timestamptz,
  ultima_interaccion  timestamptz,
  link_chat           text,
  cerrado             boolean not null default false,
  fecha_cierre        date,
  monto               numeric,
  nota                text,
  actualizado         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (negocio_id, subscriber_id)
);
create index if not exists contactos_negocio_idx on public.contactos (negocio_id, cerrado, fecha_cierre desc);

alter table public.negocios  enable row level security;
alter table public.contactos enable row level security;
grant select, insert, update, delete on public.negocios, public.contactos to service_role;
