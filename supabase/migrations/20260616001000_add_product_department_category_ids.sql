alter table public.produtos
  add column if not exists departamento_id bigint references public.departamentos(id),
  add column if not exists categoria_id bigint references public.categorias(id);

create index if not exists produtos_departamento_id_idx
  on public.produtos (departamento_id);

create index if not exists produtos_categoria_id_idx
  on public.produtos (categoria_id);
