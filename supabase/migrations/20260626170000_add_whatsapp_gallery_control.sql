alter table if exists public.whatsapp_atendimento_sessoes
  add column if not exists active_gallery_id text;

alter table if exists public.whatsapp_atendimento_sessoes
  add column if not exists photo_selection_expires_at timestamptz;

notify pgrst, 'reload schema';
