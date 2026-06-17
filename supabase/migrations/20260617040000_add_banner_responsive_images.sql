alter table public.banners
  add column if not exists imagem_desktop_url text,
  add column if not exists imagem_desktop_path text,
  add column if not exists imagem_mobile_url text,
  add column if not exists imagem_mobile_path text;

update public.banners
set
  imagem_desktop_url = coalesce(imagem_desktop_url, imagem_url),
  imagem_desktop_path = coalesce(imagem_desktop_path, imagem_path),
  imagem_mobile_url = coalesce(imagem_mobile_url, imagem_url),
  imagem_mobile_path = coalesce(imagem_mobile_path, imagem_path)
where imagem_url is not null
  and imagem_path is not null;
