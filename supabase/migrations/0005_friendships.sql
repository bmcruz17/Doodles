-- 0005_friendships.sql
-- Friend connections between members. Names are snapshotted (users table is
-- owner-scoped, so you can't read another member's profile directly). Requests
-- are created server-side by the add-friend Edge Function after resolving an
-- email to an account.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null default '',
  addressee_name text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.friendships enable row level security;

create policy friendships_read on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_insert_own on public.friendships
  for insert to authenticated with check (requester_id = auth.uid());
create policy friendships_update_addressee on public.friendships
  for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());
create policy friendships_delete_either on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx
  on public.friendships (requester_id, status);
