-- 0006_vendor_feed_and_admin.sql
-- (a) Sponsored vendor posts in the Pack feed, targeted by breed.
-- (b) Admin role for the internal ops dashboard.

-- (a) Vendor posts -------------------------------------------------------------
alter table public.posts
  add column if not exists kind text not null default 'member'
    check (kind in ('member','vendor')),
  add column if not exists vendor_id uuid references public.vendors(id) on delete cascade,
  add column if not exists vendor_name text,
  add column if not exists target_breed text,   -- null = all breeds
  add column if not exists link_url text,
  add column if not exists cta text;

-- A vendor post must reference a vendor the author owns.
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and (
      kind = 'member'
      or exists (
        select 1 from public.vendors v
        where v.id = posts.vendor_id and v.owner_id = auth.uid()
      )
    )
  );

create index if not exists posts_kind_idx on public.posts (kind, created_at desc);

-- (b) Admin role ---------------------------------------------------------------
alter table public.users add column if not exists is_admin boolean not null default false;

update public.users set is_admin = true where lower(email) = 'brandonmcruz@mac.com';

-- Only the service role may change is_admin (no self-promotion).
create or replace function public.lock_user_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_lock_admin on public.users;
create trigger users_lock_admin
  before insert or update on public.users
  for each row execute function public.lock_user_admin();

revoke execute on function public.lock_user_admin() from public, anon, authenticated;
