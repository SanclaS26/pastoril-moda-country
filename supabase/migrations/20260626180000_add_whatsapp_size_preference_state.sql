alter table if exists public.whatsapp_atendimento_sessoes
  add column if not exists pending_category text;

alter table if exists public.whatsapp_atendimento_sessoes
  add column if not exists pending_department text;

alter table if exists public.whatsapp_atendimento_sessoes
  add column if not exists requested_size text;

notify pgrst, 'reload schema';
