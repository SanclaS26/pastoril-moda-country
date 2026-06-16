create table if not exists public.banners (
  id bigserial primary key,
  titulo text,
  imagem_url text not null,
  imagem_path text not null,
  ativo boolean not null default true,
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists banners_unico_principal_ativo
  on public.banners (principal)
  where ativo = true and principal = true;

create or replace function public.set_banners_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_banners_updated_at on public.banners;

create trigger set_banners_updated_at
before update on public.banners
for each row
execute function public.set_banners_updated_at();

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do update set public = excluded.public;
