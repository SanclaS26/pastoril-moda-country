alter table public.clientes
  add column if not exists must_change_password boolean not null default false;

create unique index if not exists clientes_email_lower_unique_idx
  on public.clientes (lower(email))
  where email is not null;
