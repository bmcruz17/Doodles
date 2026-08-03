-- 0013_push_tokens.sql
-- Push notification device tokens (APNs/FCM). Owner-scoped.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'unknown' check (platform in ('ios','android','web','unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy push_tokens_owner on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger push_tokens_set_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();
