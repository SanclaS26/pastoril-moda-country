create or replace function public.prevent_vendas_delete()
returns trigger
language plpgsql
as $$
begin
  if old.tipo = 'carrinho'
    and old.status = 'em_aberto'
    and old.whatsapp_enviado_em is null
    and not old.estoque_baixado
  then
    return old;
  end if;

  raise exception 'Vendas nao devem ser excluidas. Altere o status para cancelada.';
end;
$$;

create or replace function public.excluir_carrinho_em_aberto(
  p_codigo text,
  p_session_id text default null,
  p_cliente_auth_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas%rowtype;
begin
  if nullif(btrim(p_codigo), '') is null then
    return false;
  end if;

  select *
    into v_venda
    from public.vendas
    where codigo = p_codigo
      and tipo = 'carrinho'
      and status = 'em_aberto'
      and whatsapp_enviado_em is null
      and not estoque_baixado
      and (
        (p_cliente_auth_user_id is not null and cliente_auth_user_id = p_cliente_auth_user_id)
        or (p_cliente_auth_user_id is null and p_session_id is not null and session_id = p_session_id)
      )
    for update;

  if not found then
    return false;
  end if;

  delete from public.venda_itens
    where venda_id = v_venda.id;

  delete from public.vendas
    where id = v_venda.id;

  return true;
end;
$$;

create or replace function public.excluir_carrinhos_expirados(
  p_expira_antes timestamptz default now() - interval '3 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas%rowtype;
  v_total integer := 0;
begin
  for v_venda in
    select *
      from public.vendas
      where tipo = 'carrinho'
        and status = 'em_aberto'
        and whatsapp_enviado_em is null
        and not estoque_baixado
        and updated_at < p_expira_antes
      order by updated_at
      for update skip locked
  loop
    delete from public.venda_itens
      where venda_id = v_venda.id;

    delete from public.vendas
      where id = v_venda.id;

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.excluir_carrinho_em_aberto(text, text, uuid) from public;
revoke execute on function public.excluir_carrinho_em_aberto(text, text, uuid) from anon, authenticated;
revoke execute on function public.excluir_carrinhos_expirados(timestamptz) from public;
revoke execute on function public.excluir_carrinhos_expirados(timestamptz) from anon, authenticated;
