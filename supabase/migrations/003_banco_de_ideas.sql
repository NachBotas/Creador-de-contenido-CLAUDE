-- 003 · Banco de ideas: publicaciones guardadas como referencia
create table if not exists public.ideas (
  id              uuid primary key default gen_random_uuid(),
  publicacion_id  uuid not null unique references public.publicaciones(id) on delete cascade,
  nota            text,
  created_at      timestamptz not null default now()
);

alter table public.ideas enable row level security;
grant select, insert, update, delete on public.ideas to service_role;
