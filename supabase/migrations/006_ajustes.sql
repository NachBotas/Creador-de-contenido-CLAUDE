-- 006 · Ajustes de la app (por ahora: cómo es la sincronización automática diaria)
create table if not exists public.ajustes (
  clave       text primary key,
  valor       jsonb not null,
  updated_at  timestamptz not null default now()
);
insert into public.ajustes (clave, valor) values
  ('sync_diaria', '{"feed": true, "historias": true, "dias": 7, "maximo": 8}')
on conflict (clave) do nothing;

alter table public.ajustes enable row level security;
grant select, insert, update, delete on public.ajustes to service_role;
