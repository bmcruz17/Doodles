-- 0012_launch_blockers.sql
-- Beta waitlist (public email capture) + in-app feedback.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
-- Public insert (signed-out visitors included) with basic email validation;
-- no select (admins read via service role) to prevent enumeration.
create policy waitlist_join on public.waitlist
  for insert to anon, authenticated
  with check (char_length(email) between 3 and 320 and position('@' in email) > 1);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  message text not null,
  context text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy feedback_insert_own on public.feedback
  for insert to authenticated with check (user_id = auth.uid());
create policy feedback_read_own on public.feedback
  for select to authenticated using (user_id = auth.uid());
