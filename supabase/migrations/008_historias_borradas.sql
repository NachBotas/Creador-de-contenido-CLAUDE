-- 008 · Historias descargadas y borradas de la nube (queda el registro, sin archivos)
alter table public.historias add column if not exists archivos_borrados boolean not null default false;
