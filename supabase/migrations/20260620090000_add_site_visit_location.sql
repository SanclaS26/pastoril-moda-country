alter table public.site_visits
  add column if not exists city text null,
  add column if not exists region text null,
  add column if not exists country text null;
