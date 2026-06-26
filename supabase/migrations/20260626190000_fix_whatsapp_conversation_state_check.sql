do $$
declare
  invalid_states text[];
begin
  select array_agg(distinct conversation_state order by conversation_state)
  into invalid_states
  from public.whatsapp_atendimento_sessoes
  where conversation_state is not null
    and conversation_state not in (
      'idle',
      'awaiting_intent',
      'awaiting_category',
      'awaiting_size_preference',
      'sending_gallery',
      'awaiting_photo_number',
      'showing_product_details',
      'waiting_human_service'
    );

  if invalid_states is not null then
    raise exception 'Estados de conversation_state nao contemplados na nova constraint: %', invalid_states;
  end if;
end $$;

alter table public.whatsapp_atendimento_sessoes
  drop constraint if exists whatsapp_atendimento_sessoes_conversation_state_check;

alter table public.whatsapp_atendimento_sessoes
  add constraint whatsapp_atendimento_sessoes_conversation_state_check
  check (
    conversation_state in (
      'idle',
      'awaiting_intent',
      'awaiting_category',
      'awaiting_size_preference',
      'sending_gallery',
      'awaiting_photo_number',
      'showing_product_details',
      'waiting_human_service'
    )
  );

notify pgrst, 'reload schema';
