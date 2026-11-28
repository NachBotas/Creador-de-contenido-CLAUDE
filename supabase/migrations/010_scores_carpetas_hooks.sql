-- 010 · Scores precalculados, conteos en la base, carpetas por rubro y lista de hooks

-- ---------- Scores guardados en la tabla (antes se calculaban en cada consulta) ----------
alter table public.publicaciones add column if not exists metrica bigint;
alter table public.publicaciones add column if not exists outlier numeric;
alter table public.publicaciones add column if not exists outlier_comentarios numeric;
alter table public.publicaciones add column if not exists tasa_comentarios numeric;
alter table public.publicaciones add column if not exists es_ganador boolean not null default false;

create or replace function public.recalcular_scores() returns void
language sql as $$
  with base as (
    select id, referente_id, tipo, comentarios, fecha_publicacion,
           case when tipo = 'reel' then vistas else likes end as metrica
    from public.publicaciones
  ),
  med as (
    select referente_id, tipo,
           percentile_cont(0.5) within group (order by metrica)     as mm,
           percentile_cont(0.5) within group (order by comentarios) as mc
    from base
    where metrica > 0 and fecha_publicacion > now() - interval '120 days'
    group by referente_id, tipo
  )
  update public.publicaciones p set
    metrica             = b.metrica,
    outlier             = round((b.metrica / nullif(m.mm, 0))::numeric, 2),
    outlier_comentarios = round((b.comentarios / nullif(m.mc, 0))::numeric, 2),
    tasa_comentarios    = round((b.comentarios::numeric / nullif(b.metrica, 0)) * 100, 3),
    es_ganador          = coalesce(b.metrica / nullif(m.mm, 0) >= 2, false)
  from base b
  left join med m on m.referente_id = b.referente_id and m.tipo = b.tipo
  where p.id = b.id;
$$;

-- La vista queda como un alias simple de la tabla (el código la sigue usando)
drop view if exists public.publicaciones_con_score;
create view public.publicaciones_con_score with (security_invoker = true) as
  select * from public.publicaciones;

create index if not exists publicaciones_outlier_idx     on public.publicaciones (outlier desc nulls last);
create index if not exists publicaciones_fecha_idx       on public.publicaciones (fecha_publicacion desc);
create index if not exists publicaciones_comentarios_idx on public.publicaciones (comentarios desc nulls last);

-- ---------- Carpetas por rubro (Trading, Visa, Marketing…) ----------
create table if not exists public.carpetas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.referentes add column if not exists carpeta_id uuid references public.carpetas(id) on delete set null;
alter table public.ideas      add column if not exists carpeta_id uuid references public.carpetas(id) on delete set null;

-- ---------- Mi lista de hooks ----------
create table if not exists public.hooks_guardados (
  id              uuid primary key default gen_random_uuid(),
  publicacion_id  uuid not null unique references public.publicaciones(id) on delete cascade,
  carpeta_id      uuid references public.carpetas(id) on delete set null,
  nota            text,
  created_at      timestamptz not null default now()
);

-- ---------- Conteos para pestañas y ranking, calculados en la base ----------
create or replace function public.conteos_publicaciones(
  p_tipo text, p_referentes uuid[], p_desde timestamptz, p_min numeric, p_mincom bigint,
  p_ganadores boolean, p_cta boolean, p_q text
) returns json
language sql stable as $$
  with f as (
    select formato_id, case when tipo = 'imagen' then 'carrusel' else tipo end as t, outlier, es_ganador, comentarios
    from public.publicaciones
    where (p_referentes is null or referente_id = any(p_referentes))
      and (p_desde is null or fecha_publicacion >= p_desde)
      and (p_min is null or outlier >= p_min)
      and (p_mincom is null or comentarios >= p_mincom)
      and (not coalesce(p_ganadores, false) or es_ganador)
      and (not coalesce(p_cta, false) or palabra_clave is not null)
      and (p_q is null or caption ilike '%' || p_q || '%')
  ),
  ft as (select * from f where p_tipo = 'todos' or t = p_tipo)
  select json_build_object(
    'porTipo',    coalesce((select json_object_agg(t, n) from (select t, count(*) n from f group by t) x), '{}'::json),
    'todos',      (select count(*) from f),
    'porFormato', coalesce((select json_object_agg(coalesce(formato_id::text, 'sin'), n) from (select formato_id, count(*) n from ft group by formato_id) y), '{}'::json),
    'totalTipo',  (select count(*) from ft),
    'ranking',    coalesce((select json_agg(r) from (
                    select coalesce(formato_id::text, 'sin') as clave, count(*) as piezas,
                           count(*) filter (where es_ganador) as ganadores,
                           percentile_cont(0.5) within group (order by outlier) as outlier_mediano,
                           round(avg(coalesce(comentarios, 0))) as comentarios_promedio
                    from ft where outlier is not null group by formato_id
                    order by 4 desc nulls last) r), '[]'::json)
  );
$$;

alter table public.carpetas        enable row level security;
alter table public.hooks_guardados enable row level security;
grant select, insert, update, delete on public.carpetas, public.hooks_guardados to service_role;
grant select on public.publicaciones_con_score to service_role;
grant execute on function public.recalcular_scores() to service_role;
grant execute on function public.conteos_publicaciones(text, uuid[], timestamptz, numeric, bigint, boolean, boolean, text) to service_role;

select public.recalcular_scores();
