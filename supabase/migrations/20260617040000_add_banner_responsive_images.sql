alter table public.banners
  add column if not exists imagem_desktop_url text,
  add column if not exists imagem_desktop_path text,
  add column if not exists imagem_mobile_url text,
  add column if not exists imagem_mobile_path text;
