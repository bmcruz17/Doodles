-- 0004_sitter_profiles.sql
-- Dog-sitter signup with background-check verification.
-- Sitters create a profile and consent to a background check; an admin / the
-- background-check provider (e.g. Checkr) flips verification. Owners browse
-- only verified, listed sitters. Sensitive ID docs live in the private
-- pet-documents bucket (owner-scoped); only the public profile photo is public.

create table if not exists public.sitter_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  location text,
  photo_url text,
  hourly_rate numeric(10,2),
  years_experience int,
  services text[] not null default '{}',
  -- verification (admin / provider controlled — see trigger below)
  background_check_status text not null default 'not_started'
    check (background_check_status in
      ('not_started','consent_given','submitted','in_review','approved','rejected')),
  background_check_consent_at timestamptz,
  id_document_url text,            -- private storage path (pet-documents/<uid>/_verification/...)
  verified boolean not null default false,
  listed boolean not null default false,
  rating numeric(2,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sitter_profiles enable row level security;

-- Owners browsing the directory see verified + listed sitters; a sitter always
-- sees their own row.
create policy sitter_profiles_read on public.sitter_profiles
  for select to authenticated
  using ((verified and listed) or user_id = auth.uid());
create policy sitter_profiles_insert_own on public.sitter_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy sitter_profiles_update_own on public.sitter_profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sitter_profiles_delete_own on public.sitter_profiles
  for delete to authenticated using (user_id = auth.uid());

-- Sitters can edit their bio/rates and advance their own check to 'submitted',
-- but can NEVER self-verify or set review/approved/rejected. Only the service
-- role (admin endpoint / Checkr webhook) may set those.
create or replace function public.lock_sitter_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.verified := false;
      if new.background_check_status not in
         ('not_started','consent_given','submitted') then
        new.background_check_status := 'not_started';
      end if;
    elsif tg_op = 'UPDATE' then
      new.verified := old.verified;
      if new.background_check_status not in
         ('not_started','consent_given','submitted') then
        new.background_check_status := old.background_check_status;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger sitter_lock_verification
  before insert or update on public.sitter_profiles
  for each row execute function public.lock_sitter_verification();

create trigger sitter_set_updated_at
  before update on public.sitter_profiles
  for each row execute function public.set_updated_at();

create index if not exists sitter_profiles_directory_idx
  on public.sitter_profiles (verified, listed);

revoke execute on function public.lock_sitter_verification() from public, anon, authenticated;
