-- 007 · Historias guardadas en Google Drive (archivo completo; la miniatura queda en Supabase)
alter table public.historias add column if not exists drive_archivo_id text;   -- id del archivo en Drive (video o imagen)
alter table public.historias add column if not exists drive_estado text;       -- null = pendiente · 'ok' · 'no-disponible'
create index if not exists historias_drive_pendientes_idx on public.historias (created_at) where drive_estado is null;
