create extension if not exists pgcrypto;

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  session_id uuid not null,
  pathname text not null,
  created_at timestamptz not null default now(),
  constraint site_visits_pathname_length check (char_length(pathname) between 1 and 300),
  constraint site_visits_public_path check (
    pathname like '/%' and
    pathname not like '/admin%' and
    pathname not like '/api/%' and
    pathname not like '/_next/%'
  )
);

create index if not exists site_visits_created_at_idx
  on public.site_visits (created_at desc);

create index if not exists site_visits_visitor_created_at_idx
  on public.site_visits (visitor_id, created_at desc);

create index if not exists site_visits_session_path_created_at_idx
  on public.site_visits (session_id, pathname, created_at desc);

create index if not exists site_visits_path_created_at_idx
  on public.site_visits (pathname, created_at desc);

alter table public.site_visits enable row level security;

revoke all on table public.site_visits from anon, authenticated;
