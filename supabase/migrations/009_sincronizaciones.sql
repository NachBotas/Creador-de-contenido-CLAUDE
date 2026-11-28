-- 009 · Seguimiento de cada sincronización (para la barra de progreso)
create table if not exists public.sincronizaciones (
  id            uuid primary key default gen_random_uuid(),
  run_id        text not null unique,          -- corrida de Apify
  dataset_id    text,
  tipo          text not null,                 -- posts | historias | detalles
  etiqueta      text not null,                 -- texto para mostrar
  esperado      int,                           -- máximo de resultados esperados (si se sabe)
  estado        text not null default 'corriendo', -- corriendo | guardando | listo | error
  guardados     int,
  mensaje       text,
  created_at    timestamptz not null default now(),
  terminado_at  timestamptz
);
create index if not exists sincronizaciones_recientes_idx on public.sincronizaciones (created_at desc);
alter table public.sincronizaciones enable row level security;
grant select, insert, update, delete on public.sincronizaciones to service_role;
