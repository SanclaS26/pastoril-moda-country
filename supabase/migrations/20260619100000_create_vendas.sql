create extension if not exists pgcrypto;

create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null default 'carrinho' check (tipo in ('carrinho', 'pedido_whatsapp')),
  status text not null default 'em_aberto' check (status in ('em_aberto', 'concluida', 'cancelada')),
  cliente_auth_user_id uuid references auth.users(id) on delete set null,
  cliente_nome text,
  cliente_cpf text,
  cliente_celular text,
  session_id text,
  telefone_whatsapp text,
  total_original numeric(12,2) not null default 0 check (total_original >= 0),
  total_final numeric(12,2) check (total_final is null or total_final >= 0),
  observacoes_admin text,
  whatsapp_enviado_em timestamptz,
  estoque_baixado boolean not null default false,
  estoque_ciclo integer not null default 0 check (estoque_ciclo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendas_cliente_ou_sessao_check check (
    cliente_auth_user_id is not null
    or nullif(btrim(session_id), '') is not null
  )
);

create table if not exists public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete restrict,
  produto_id integer not null references public.produtos(id) on delete restrict,
  estoque_produto_id integer references public.estoque_produtos(id) on delete restrict,
  codigo_produto text not null,
  nome text not null,
  tamanho text not null,
  quantidade_original integer not null check (quantidade_original > 0),
  quantidade_final integer not null check (quantidade_final >= 0),
  valor_unitario_original numeric(12,2) not null default 0 check (valor_unitario_original >= 0),
  valor_unitario_final numeric(12,2) not null default 0 check (valor_unitario_final >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venda_estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete restrict,
  venda_item_id uuid not null references public.venda_itens(id) on delete restrict,
  produto_id integer not null references public.produtos(id) on delete restrict,
  estoque_produto_id integer not null references public.estoque_produtos(id) on delete restrict,
  tamanho text not null,
  quantidade integer not null check (quantidade > 0),
  tipo text not null check (tipo in ('baixa', 'restauracao')),
  ciclo integer not null check (ciclo > 0),
  created_at timestamptz not null default now(),
  constraint venda_movimento_item_venda_unique unique (venda_item_id, tipo, ciclo)
);

create index if not exists vendas_status_created_at_idx
  on public.vendas (status, created_at desc);

create index if not exists vendas_tipo_status_idx
  on public.vendas (tipo, status);

create index if not exists vendas_cliente_auth_user_id_idx
  on public.vendas (cliente_auth_user_id);

create index if not exists vendas_session_id_idx
  on public.vendas (session_id);

create index if not exists venda_itens_venda_id_idx
  on public.venda_itens (venda_id);

create index if not exists venda_itens_estoque_produto_id_idx
  on public.venda_itens (estoque_produto_id);

create index if not exists venda_movimentos_venda_id_idx
  on public.venda_estoque_movimentos (venda_id);

create index if not exists venda_movimentos_venda_item_id_idx
  on public.venda_estoque_movimentos (venda_item_id);

create index if not exists venda_movimentos_estoque_produto_id_idx
  on public.venda_estoque_movimentos (estoque_produto_id);

create or replace function public.set_vendas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vendas_updated_at on public.vendas;

create trigger set_vendas_updated_at
before update on public.vendas
for each row
execute function public.set_vendas_updated_at();

create or replace function public.set_venda_itens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_venda_itens_updated_at on public.venda_itens;

create trigger set_venda_itens_updated_at
before update on public.venda_itens
for each row
execute function public.set_venda_itens_updated_at();

create or replace function public.prevent_venda_itens_change_when_stock_applied()
returns trigger
language plpgsql
as $$
declare
  v_venda_id uuid;
  v_estoque_baixado boolean;
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    v_venda_id := new.venda_id;
  else
    v_venda_id := old.venda_id;
  end if;

  select estoque_baixado
    into v_estoque_baixado
    from public.vendas
    where id = v_venda_id
    for update;

  if v_estoque_baixado then
    raise exception 'Reabra a venda antes de alterar seus itens.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_venda_itens_change_when_stock_applied on public.venda_itens;

create trigger prevent_venda_itens_change_when_stock_applied
before insert or update or delete on public.venda_itens
for each row
execute function public.prevent_venda_itens_change_when_stock_applied();

create or replace function public.prevent_vendas_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Vendas nao devem ser excluidas. Altere o status para cancelada.';
end;
$$;

drop trigger if exists prevent_vendas_delete on public.vendas;

create trigger prevent_vendas_delete
before delete on public.vendas
for each row
execute function public.prevent_vendas_delete();

create or replace function public.prevent_venda_estoque_movimentos_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Historico de movimentos de estoque nao deve ser excluido.';
end;
$$;

drop trigger if exists prevent_venda_estoque_movimentos_delete on public.venda_estoque_movimentos;

create trigger prevent_venda_estoque_movimentos_delete
before delete on public.venda_estoque_movimentos
for each row
execute function public.prevent_venda_estoque_movimentos_delete();

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
        total_final = coalesce(
          total_final,
          (
            select coalesce(sum(quantidade_final * valor_unitario_final), 0)
            from public.venda_itens
            where venda_id = p_venda_id
          )
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
      set status = p_novo_status
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
        estoque_baixado = false
    where id = p_venda_id
    returning * into v_venda;

  return v_venda;
end;
$$;

create or replace function public.cancelar_venda(p_venda_id uuid)
returns public.vendas
language sql
security definer
set search_path = public
as $$
  select public.restaurar_estoque_venda(p_venda_id, 'cancelada');
$$;

create or replace function public.reabrir_venda(p_venda_id uuid)
returns public.vendas
language sql
security definer
set search_path = public
as $$
  select public.restaurar_estoque_venda(p_venda_id, 'em_aberto');
$$;

alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.venda_estoque_movimentos enable row level security;

revoke all on table public.vendas from anon, authenticated;
revoke all on table public.venda_itens from anon, authenticated;
revoke all on table public.venda_estoque_movimentos from anon, authenticated;

revoke execute on function public.concluir_venda(uuid) from anon, authenticated;
revoke execute on function public.restaurar_estoque_venda(uuid, text) from anon, authenticated;
revoke execute on function public.cancelar_venda(uuid) from anon, authenticated;
revoke execute on function public.reabrir_venda(uuid) from anon, authenticated;
revoke execute on function public.concluir_venda(uuid) from public;
revoke execute on function public.restaurar_estoque_venda(uuid, text) from public;
revoke execute on function public.cancelar_venda(uuid) from public;
revoke execute on function public.reabrir_venda(uuid) from public;
