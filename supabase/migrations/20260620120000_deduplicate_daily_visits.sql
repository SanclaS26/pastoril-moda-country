alter table public.site_visits
  add column if not exists user_id uuid null references auth.users(id) on delete set null,
  add column if not exists visit_date date null,
  alter column visitor_id drop not null;

create unique index if not exists site_visits_user_day_unique
  on public.site_visits (user_id, visit_date)
  where user_id is not null and visit_date is not null;

create unique index if not exists site_visits_visitor_day_unique
  on public.site_visits (visitor_id, visit_date)
  where visitor_id is not null and visit_date is not null;

create index if not exists site_visits_visit_date_idx
  on public.site_visits (visit_date desc);

notify pgrst, 'reload schema';
