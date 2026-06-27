-- Catalogo relacional de produtos.
-- Mantem as colunas textuais existentes como snapshots para compatibilidade
-- com pedidos, WhatsApp e futuras integracoes ERP.

begin;

-- Categorias ja existem no banco atual e deixam de depender obrigatoriamente
-- de um departamento. Nenhuma categoria ou departamento e removido.
alter table public.categorias
  alter column departamento_id drop not null;

alter table public.categorias
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists tipo_grade text not null default 'unico',
  add column if not exists slug text;

-- O schema legado da Pastoril exige slug em categorias. A funcao abaixo nao
-- depende da extensao unaccent e pode ser usada tanto no seed quanto em novos
-- cadastros feitos pelas rotas administrativas.
create or replace function public.catalog_slug(p_value text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        translate(
          lower(btrim(p_value)),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'categoria'
  );
$$;

create or replace function public.set_categoria_slug()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 2;
  v_payload jsonb;
begin
  if new.nome is null or btrim(new.nome) = '' then
    raise exception 'O nome da categoria e obrigatorio.';
  end if;

  if new.slug is null
    or btrim(new.slug) = ''
    or (
      tg_op = 'UPDATE'
      and new.nome is distinct from old.nome
      and new.slug is not distinct from old.slug
    )
  then
    v_base := public.catalog_slug(new.nome);
  else
    v_base := public.catalog_slug(new.slug);
  end if;

  v_candidate := v_base;
  while exists (
    select 1
    from public.categorias c
    where lower(c.slug) = lower(v_candidate)
      and c.id is distinct from new.id
  ) loop
    v_candidate := v_base || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  new.slug := v_candidate;

  -- Algumas versoes do schema legado possuem codigo/code obrigatorio. O uso
  -- de jsonb permite preencher essas colunas quando existirem sem tornar a
  -- migration incompatível com bancos que nao as possuem.
  v_payload := to_jsonb(new);
  if v_payload ? 'codigo'
    and nullif(btrim(v_payload->>'codigo'), '') is null
  then
    v_payload := jsonb_set(
      v_payload,
      '{codigo}',
      to_jsonb('CAT-' || upper(replace(v_candidate, '-', '_'))),
      true
    );
  end if;
  if v_payload ? 'code'
    and nullif(btrim(v_payload->>'code'), '') is null
  then
    v_payload := jsonb_set(
      v_payload,
      '{code}',
      to_jsonb('CAT-' || upper(replace(v_candidate, '-', '_'))),
      true
    );
  end if;
  new := jsonb_populate_record(new, v_payload);

  return new;
end;
$$;

drop trigger if exists categorias_set_slug on public.categorias;
create trigger categorias_set_slug
before insert or update of nome, slug on public.categorias
for each row execute function public.set_categoria_slug();

-- Corrige bancos parcialmente atualizados que ja possuem categorias sem slug.
-- O trigger garante sufixos numericos caso existam nomes repetidos.
update public.categorias
set slug = null
where slug is null or btrim(slug) = '';

alter table public.categorias
  alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categorias'::regclass
      and conname = 'categorias_tipo_grade_check'
  ) then
    alter table public.categorias
      add constraint categorias_tipo_grade_check
      check (tipo_grade in ('roupas', 'calcados', 'chapeus_bones', 'cintos', 'unico'));
  end if;
end;
$$;

create unique index if not exists categorias_nome_unique
  on public.categorias (lower(nome));

-- Evita ON CONFLICT com indice por expressao. Este bloco tambem funciona caso
-- a migration seja retomada depois de uma execucao interrompida.
insert into public.categorias (nome, slug, ativo, ordem, tipo_grade)
select seed.nome, seed.slug, true, seed.ordem, seed.tipo_grade
from (
  values
    ('Camisas', 'camisas', 10, 'roupas'),
    ('Camisetas', 'camisetas', 20, 'roupas'),
    ('Calças', 'calcas', 30, 'roupas'),
    ('Botas', 'botas', 40, 'calcados'),
    ('Botinas', 'botinas', 50, 'calcados'),
    ('Chapéus', 'chapeus', 60, 'chapeus_bones'),
    ('Bonés', 'bones', 70, 'chapeus_bones'),
    ('Cintos', 'cintos', 80, 'cintos'),
    ('Bolsas', 'bolsas', 90, 'unico'),
    ('Vestidos', 'vestidos', 100, 'roupas'),
    ('Saias', 'saias', 110, 'roupas'),
    ('Acessórios', 'acessorios', 120, 'unico'),
    ('Outros', 'outros', 130, 'unico')
) as seed(nome, slug, ordem, tipo_grade)
where not exists (
  select 1
  from public.categorias c
  where lower(c.nome) = lower(seed.nome)
);

update public.categorias
set tipo_grade = case
  when lower(nome) in ('camisas', 'camisetas', 'calças', 'calcas', 'vestidos', 'saias') then 'roupas'
  when lower(nome) in ('botas', 'botinas') then 'calcados'
  when lower(nome) in ('chapéus', 'chapeus', 'bonés', 'bones') then 'chapeus_bones'
  when lower(nome) = 'cintos' then 'cintos'
  else 'unico'
end
where tipo_grade = 'unico';

create table if not exists public.marcas (
  id bigint generated by default as identity primary key,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marcas_nome_unique
  on public.marcas (lower(nome));

insert into public.marcas (nome, ativo)
select 'Indefinida', true
where not exists (
  select 1 from public.marcas where lower(nome) = 'indefinida'
);

-- Se a linha ja existia, garante que a marca padrao esteja utilizavel.
update public.marcas
set nome = 'Indefinida', ativo = true
where lower(nome) = 'indefinida'
  and (nome is distinct from 'Indefinida' or ativo is distinct from true);

alter table public.produtos
  add column if not exists marca_id bigint references public.marcas(id) on delete restrict;

update public.produtos
set marca_id = (
  select id from public.marcas where lower(nome) = 'indefinida' limit 1
)
where marca_id is null;

-- Publico passa a ser obrigatorio sem descartar produtos preexistentes.
update public.produtos
set publico = 'Unissex'
where publico is null or btrim(publico) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.produtos'::regclass
      and conname = 'produtos_publico_check'
  ) then
    alter table public.produtos
      add constraint produtos_publico_check
      check (publico in ('Masculino', 'Feminino', 'Infantil', 'Unissex'));
  end if;
end;
$$;

alter table public.produtos
  alter column publico set not null,
  alter column marca_id set not null;

create index if not exists produtos_marca_id_idx
  on public.produtos (marca_id);

create or replace function public.set_default_product_brand()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.marca_id is null then
    select id into new.marca_id
    from public.marcas
    where lower(nome) = 'indefinida' and ativo = true
    limit 1;
  end if;

  if new.marca_id is null then
    raise exception 'A marca padrao Indefinida nao foi encontrada.';
  end if;

  return new;
end;
$$;

drop trigger if exists produtos_set_default_brand on public.produtos;
create trigger produtos_set_default_brand
before insert or update of marca_id on public.produtos
for each row execute function public.set_default_product_brand();

-- Impede que operacoes acidentais removam a marca exigida pelo cadastro.
create or replace function public.protect_default_brand()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if lower(old.nome) = 'indefinida' then
    if tg_op = 'DELETE' then
      raise exception 'A marca padrao Indefinida nao pode ser excluida.';
    end if;

    if lower(new.nome) <> 'indefinida' or new.ativo is not true then
      raise exception 'A marca padrao Indefinida nao pode ser renomeada ou inativada.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists marcas_protect_default on public.marcas;
create trigger marcas_protect_default
before update or delete on public.marcas
for each row execute function public.protect_default_brand();

-- produtos.id e integer no schema atual; usar o mesmo tipo evita uma FK
-- implicitamente divergente das tabelas de vendas e estoque.
create table if not exists public.produto_imagens (
  id bigint generated by default as identity primary key,
  produto_id integer not null references public.produtos(id) on delete cascade,
  tipo_midia text not null default 'imagem',
  url text not null,
  storage_path text,
  ordem smallint not null default 0,
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produto_imagens_tipo_check check (tipo_midia in ('imagem', 'video')),
  constraint produto_imagens_ordem_check check (ordem between 0 and 9),
  constraint produto_imagens_produto_ordem_key unique (produto_id, ordem)
);

create unique index if not exists produto_imagens_principal_unique
  on public.produto_imagens (produto_id)
  where principal;

create index if not exists produto_imagens_produto_ordem_idx
  on public.produto_imagens (produto_id, ordem);

-- Uma imagem por posicao (0..9) limita estruturalmente a galeria a 10 itens.
insert into public.produto_imagens (
  produto_id, tipo_midia, url, storage_path, ordem, principal
)
select p.id, 'imagem', p.imagem_principal, null, 0, true
from public.produtos p
where p.imagem_principal is not null
  and not exists (
    select 1 from public.produto_imagens pi where pi.produto_id = p.id
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categorias_set_updated_at on public.categorias;
create trigger categorias_set_updated_at
before update on public.categorias
for each row execute function public.set_updated_at();

drop trigger if exists marcas_set_updated_at on public.marcas;
create trigger marcas_set_updated_at
before update on public.marcas
for each row execute function public.set_updated_at();

drop trigger if exists produto_imagens_set_updated_at on public.produto_imagens;
create trigger produto_imagens_set_updated_at
before update on public.produto_imagens
for each row execute function public.set_updated_at();

-- Substitui a galeria em uma unica transacao no servidor. A funcao nao faz
-- upload: ela apenas sincroniza metadados ja validados pela rota administrativa.
create or replace function public.sincronizar_produto_imagens(
  p_produto_id integer,
  p_imagens jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_imagens) is distinct from 'array' then
    raise exception 'Galeria invalida.';
  end if;

  v_count := jsonb_array_length(p_imagens);
  if v_count < 1 or v_count > 10 then
    raise exception 'A galeria deve conter de 1 a 10 itens.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_imagens) item
    where coalesce(item->>'tipo_midia', 'imagem') not in ('imagem', 'video')
      or nullif(btrim(item->>'url'), '') is null
  ) then
    raise exception 'Item de galeria invalido.';
  end if;

  delete from public.produto_imagens
  where produto_id = p_produto_id;

  insert into public.produto_imagens (
    produto_id, tipo_midia, url, storage_path, ordem, principal
  )
  select
    p_produto_id,
    coalesce(item->>'tipo_midia', 'imagem'),
    item->>'url',
    nullif(item->>'storage_path', ''),
    (ordinality - 1)::smallint,
    ordinality = 1
  from jsonb_array_elements(p_imagens) with ordinality as gallery(item, ordinality);
end;
$$;

revoke all on function public.sincronizar_produto_imagens(integer, jsonb) from public;
revoke all on function public.sincronizar_produto_imagens(integer, jsonb) from anon;
revoke all on function public.sincronizar_produto_imagens(integer, jsonb) from authenticated;
grant execute on function public.sincronizar_produto_imagens(integer, jsonb) to service_role;

-- Predicado minimo para a policy publica de imagens. SECURITY DEFINER evita
-- que o resultado dependa das policies preexistentes de produtos, sem expor
-- qualquer dado do produto.
create or replace function public.produto_esta_ativo(p_produto_id integer)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.produtos p
    where p.id = p_produto_id and p.ativo = true
  );
$$;

revoke all on function public.produto_esta_ativo(integer) from public;
grant execute on function public.produto_esta_ativo(integer) to anon, authenticated, service_role;

-- RLS: anon/authenticated so leem registros ativos necessarios a vitrine.
-- Nenhuma policy de escrita e criada; rotas administrativas usam service_role,
-- que contorna RLS no servidor depois da autenticacao administrativa.
alter table public.categorias enable row level security;
alter table public.marcas enable row level security;
alter table public.produto_imagens enable row level security;

revoke insert, update, delete, truncate, references, trigger
  on table public.categorias from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.marcas from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.produto_imagens from anon, authenticated;

grant select on table public.categorias to anon, authenticated;
grant select on table public.marcas to anon, authenticated;
grant select on table public.produto_imagens to anon, authenticated;

drop policy if exists categorias_public_select_active on public.categorias;
create policy categorias_public_select_active
on public.categorias
for select
to anon, authenticated
using (ativo = true);

drop policy if exists marcas_public_select_active on public.marcas;
create policy marcas_public_select_active
on public.marcas
for select
to anon, authenticated
using (ativo = true);

drop policy if exists produto_imagens_public_select_active on public.produto_imagens;
create policy produto_imagens_public_select_active
on public.produto_imagens
for select
to anon, authenticated
using (public.produto_esta_ativo(produto_id));

commit;
