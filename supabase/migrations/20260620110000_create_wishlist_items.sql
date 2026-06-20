create extension if not exists pgcrypto;

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.produtos(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wishlist_items_user_product_unique unique (user_id, product_id)
);

create index if not exists wishlist_items_user_id_idx
  on public.wishlist_items (user_id);

create index if not exists wishlist_items_product_id_idx
  on public.wishlist_items (product_id);

create index if not exists wishlist_items_created_at_idx
  on public.wishlist_items (created_at desc);

alter table public.wishlist_items enable row level security;

revoke all on table public.wishlist_items from anon;
grant select, insert, delete on table public.wishlist_items to authenticated;

drop policy if exists wishlist_items_select_own on public.wishlist_items;
create policy wishlist_items_select_own
  on public.wishlist_items
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists wishlist_items_insert_own on public.wishlist_items;
create policy wishlist_items_insert_own
  on public.wishlist_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists wishlist_items_delete_own on public.wishlist_items;
create policy wishlist_items_delete_own
  on public.wishlist_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
