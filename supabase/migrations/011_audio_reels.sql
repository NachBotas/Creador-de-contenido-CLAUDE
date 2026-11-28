-- 011 · Audio aparte de los reels
-- Algunos reels llegan de Instagram con el video y el audio en dos archivos (formato DASH).
alter table public.publicaciones add column if not exists audio_url text;
