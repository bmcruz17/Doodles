-- 0014_pack_profiles.sql
-- Household "pack profile": one social identity per household (represents one
-- or more dogs). This is who posts appear as. Discoverable within the app.
create table if not exists public.pack_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text not null default '',
  avatar_url text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pack_profiles enable row level security;
create policy pack_read on public.pack_profiles
  for select to authenticated using (true);
create policy pack_insert_own on public.pack_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy pack_update_own on public.pack_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pack_delete_own on public.pack_profiles
  for delete to authenticated using (user_id = auth.uid());
create trigger pack_set_updated_at before update on public.pack_profiles
  for each row execute function public.set_updated_at();

alter table public.posts
  add column if not exists pack_handle text,
  add column if not exists pack_avatar text;
