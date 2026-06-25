alter table public.vendas
add column if not exists first_admin_response_at timestamptz null;

create index if not exists vendas_first_admin_response_at_idx
on public.vendas (first_admin_response_at);

create or replace function public.concluir_venda(p_venda_id uuid)
returns public.vendas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas%rowtype;
  v_item public.venda_itens%rowtype;
  v_estoque public.estoque_produtos%rowtype;
  v_ciclo integer;
  v_now timestamptz := now();
begin
  select *
    into v_venda
    from public.vendas
    where id = p_venda_id
    for update;

  if not found then
    raise exception 'Venda nao encontrada.';
  end if;

  if v_venda.status = 'cancelada' then
    raise exception 'Venda cancelada nao pode ser concluida sem ser reaberta.';
  end if;

  if v_venda.estoque_baixado then
    raise exception 'Estoque desta venda ja foi baixado.';
  end if;

  if not exists (
    select 1
    from public.venda_itens
    where venda_id = p_venda_id
      and quantidade_final > 0
  ) then
    raise exception 'Venda sem itens com quantidade final positiva nao pode ser concluida.';
  end if;

  v_ciclo := v_venda.estoque_ciclo + 1;

  for v_item in
    select *
      from public.venda_itens
      where venda_id = p_venda_id
        and quantidade_final > 0
      order by id
      for update
  loop
    if v_item.estoque_produto_id is null then
      raise exception 'Item % nao possui estoque vinculado.', v_item.nome;
    end if;

    select *
      into v_estoque
      from public.estoque_produtos
      where id = v_item.estoque_produto_id
        and produto_id = v_item.produto_id
        and tamanho = v_item.tamanho
      for update;

    if not found then
      raise exception 'Estoque nao encontrado para % (%).', v_item.nome, v_item.tamanho;
    end if;

    if v_estoque.quantidade < v_item.quantidade_final then
      raise exception 'Estoque insuficiente para % (%). Disponivel: %, solicitado: %.',
        v_item.nome,
        v_item.tamanho,
        v_estoque.quantidade,
        v_item.quantidade_final;
    end if;

    update public.estoque_produtos
      set quantidade = quantidade - v_item.quantidade_final
      where id = v_estoque.id;

    insert into public.venda_estoque_movimentos (
      venda_id,
      venda_item_id,
      produto_id,
      estoque_produto_id,
      tamanho,
      quantidade,
      tipo,
      ciclo
    ) values (
      p_venda_id,
      v_item.id,
      v_item.produto_id,
      v_estoque.id,
      v_item.tamanho,
      v_item.quantidade_final,
      'baixa',
      v_ciclo
    );
  end loop;

  update public.vendas
    set status = 'concluida',
        estoque_baixado = true,
        estoque_ciclo = v_ciclo,
        concluded_at = v_now,
        first_admin_response_at = case
          when tipo = 'pedido_whatsapp' and whatsapp_enviado_em is not null
            then coalesce(first_admin_response_at, v_now)
          else first_admin_response_at
        end,
        total_final = (
          select coalesce(sum(quantidade_final * valor_unitario_final), 0)
          from public.venda_itens
          where venda_id = p_venda_id
        )
    where id = p_venda_id
    returning * into v_venda;

  return v_venda;
end;
$$;

create or replace function public.restaurar_estoque_venda(p_venda_id uuid, p_novo_status text)
returns public.vendas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas%rowtype;
  v_movimento public.venda_estoque_movimentos%rowtype;
  v_now timestamptz := now();
begin
  if p_novo_status not in ('em_aberto', 'cancelada') then
    raise exception 'Status invalido para restauracao de estoque.';
  end if;

  select *
    into v_venda
    from public.vendas
    where id = p_venda_id
    for update;

  if not found then
    raise exception 'Venda nao encontrada.';
  end if;

  if not v_venda.estoque_baixado then
    update public.vendas
      set status = p_novo_status,
          concluded_at = case when p_novo_status = 'em_aberto' then null else concluded_at end,
          first_admin_response_at = case
            when tipo = 'pedido_whatsapp' and whatsapp_enviado_em is not null
              then coalesce(first_admin_response_at, v_now)
            else first_admin_response_at
          end
      where id = p_venda_id
      returning * into v_venda;

    return v_venda;
  end if;

  for v_movimento in
    select *
      from public.venda_estoque_movimentos
      where venda_id = p_venda_id
        and tipo = 'baixa'
        and ciclo = v_venda.estoque_ciclo
      order by id
      for update
  loop
    if exists (
      select 1
      from public.venda_estoque_movimentos
      where venda_item_id = v_movimento.venda_item_id
        and tipo = 'restauracao'
        and ciclo = v_movimento.ciclo
    ) then
      raise exception 'Estoque do item % ja foi restaurado neste ciclo.', v_movimento.venda_item_id;
    end if;

    update public.estoque_produtos
      set quantidade = quantidade + v_movimento.quantidade
      where id = v_movimento.estoque_produto_id;

    insert into public.venda_estoque_movimentos (
      venda_id,
      venda_item_id,
      produto_id,
      estoque_produto_id,
      tamanho,
      quantidade,
      tipo,
      ciclo
    ) values (
      p_venda_id,
      v_movimento.venda_item_id,
      v_movimento.produto_id,
      v_movimento.estoque_produto_id,
      v_movimento.tamanho,
      v_movimento.quantidade,
      'restauracao',
      v_movimento.ciclo
    );
  end loop;

  update public.vendas
    set status = p_novo_status,
        estoque_baixado = false,
        concluded_at = case when p_novo_status = 'em_aberto' then null else concluded_at end,
        first_admin_response_at = case
          when tipo = 'pedido_whatsapp' and whatsapp_enviado_em is not null
            then coalesce(first_admin_response_at, v_now)
          else first_admin_response_at
        end
    where id = p_venda_id
    returning * into v_venda;

  return v_venda;
end;
$$;

create or replace function public.registrar_primeira_resposta_admin(p_venda_id uuid)
returns public.vendas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas%rowtype;
begin
  update public.vendas
    set first_admin_response_at = coalesce(first_admin_response_at, now())
    where id = p_venda_id
      and tipo = 'pedido_whatsapp'
      and whatsapp_enviado_em is not null
    returning * into v_venda;

  if not found then
    select *
      into v_venda
      from public.vendas
      where id = p_venda_id;
  end if;

  return v_venda;
end;
$$;

notify pgrst, 'reload schema';
