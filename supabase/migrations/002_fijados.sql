-- 002 · Marcar publicaciones fijadas (las fijadas no se comparan contra el promedio igual que el resto)
alter table public.publicaciones add column if not exists fijado boolean not null default false;

drop view if exists public.publicaciones_con_score;
create view public.publicaciones_con_score
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

grant select on public.publicaciones_con_score to service_role;
