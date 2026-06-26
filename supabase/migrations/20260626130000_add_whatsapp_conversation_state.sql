alter table if exists public.whatsapp_atendimento_sessoes
  add column if not exists conversation_state text not null default 'idle';

alter table if exists public.whatsapp_atendimento_sessoes
  drop constraint if exists whatsapp_atendimento_sessoes_conversation_state_check;

alter table if exists public.whatsapp_atendimento_sessoes
  add constraint whatsapp_atendimento_sessoes_conversation_state_check
  check (conversation_state in ('idle', 'sending_gallery', 'awaiting_photo_number'));

notify pgrst, 'reload schema';
