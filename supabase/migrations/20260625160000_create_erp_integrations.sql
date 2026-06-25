create table if not exists public.erp_integrations (
  id smallint primary key default 1 check (id = 1),
  erp_name text,
  provider_name text,
  api_base_url text,
  api_version text,
  environment text not null default 'Homologacao' check (environment in ('Producao', 'Homologacao', 'Sandbox')),
  auth_type text not null default 'Ainda nao definido' check (auth_type in ('API Key', 'Bearer Token', 'OAuth 2.0', 'Usuario e senha', 'Ainda nao definido')),
  sync_interval_minutes integer not null default 10 check (sync_interval_minutes between 1 and 1440),
  sync_products boolean not null default false,
  sync_categories boolean not null default false,
  sync_prices boolean not null default false,
  sync_images boolean not null default false,
  sync_stock boolean not null default false,
  send_confirmed_sales boolean not null default false,
  is_active boolean not null default false,
  credentials_configured boolean not null default false,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_erp_integrations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_erp_integrations_updated_at on public.erp_integrations;

create trigger set_erp_integrations_updated_at
before update on public.erp_integrations
for each row
execute function public.set_erp_integrations_updated_at();

alter table public.erp_integrations enable row level security;

revoke all on table public.erp_integrations from anon, authenticated;
grant select, insert, update on table public.erp_integrations to authenticated;

drop policy if exists erp_integrations_admin_select on public.erp_integrations;
create policy erp_integrations_admin_select
  on public.erp_integrations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where ativo = true
        and (user_id = auth.uid() or email = auth.jwt() ->> 'email')
    )
  );

drop policy if exists erp_integrations_admin_insert on public.erp_integrations;
create policy erp_integrations_admin_insert
  on public.erp_integrations
  for insert
  to authenticated
  with check (
    id = 1
    and exists (
      select 1
      from public.admin_users
      where ativo = true
        and (user_id = auth.uid() or email = auth.jwt() ->> 'email')
    )
  );

drop policy if exists erp_integrations_admin_update on public.erp_integrations;
create policy erp_integrations_admin_update
  on public.erp_integrations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where ativo = true
        and (user_id = auth.uid() or email = auth.jwt() ->> 'email')
    )
  )
  with check (
    id = 1
    and exists (
      select 1
      from public.admin_users
      where ativo = true
        and (user_id = auth.uid() or email = auth.jwt() ->> 'email')
    )
  );
