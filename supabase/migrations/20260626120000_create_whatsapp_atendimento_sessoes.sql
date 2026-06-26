create extension if not exists pgcrypto;

create table if not exists public.whatsapp_atendimento_sessoes (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  session_started_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  site_notice_sent boolean not null default false,
  awaiting_product_position boolean not null default false,
  last_category text,
  presented_products jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_atendimento_sessoes_last_interaction_idx
  on public.whatsapp_atendimento_sessoes (last_interaction_at desc);

create or replace function public.set_whatsapp_atendimento_sessoes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_whatsapp_atendimento_sessoes_updated_at on public.whatsapp_atendimento_sessoes;
create trigger set_whatsapp_atendimento_sessoes_updated_at
before update on public.whatsapp_atendimento_sessoes
for each row
execute function public.set_whatsapp_atendimento_sessoes_updated_at();

alter table public.whatsapp_atendimento_sessoes enable row level security;

notify pgrst, 'reload schema';
