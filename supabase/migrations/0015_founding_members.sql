-- 0015_founding_members.sql
-- Founding Pawthers: the first 100 members of the closed beta.
--
-- The offer: the beta is FREE, and a founding member's rate is locked in at the
-- prices published today, honored when billing turns on later. So the claim has
-- to be (a) capped and race-free, (b) unforgeable by the client, and (c) it has
-- to record the actual locked prices, or "grandfathered" is just a promise with
-- nothing behind it.

-- ---------------------------------------------------------------------------
-- 1) Waitlist: dedupe, and capture a little more at the top of the funnel.
-- ---------------------------------------------------------------------------

-- One spot per person. Keep the earliest row for each email — position in the
-- list is the whole point, so the first submission wins.
delete from public.waitlist a
  using public.waitlist b
 where lower(a.email) = lower(b.email)
   and (a.created_at, a.id) > (b.created_at, b.id);

create unique index if not exists waitlist_email_unique
  on public.waitlist (lower(email));

alter table public.waitlist
  add column if not exists dog_name text,
  add column if not exists zip      text,
  add column if not exists ref      text;

-- ---------------------------------------------------------------------------
-- 2) Founding columns on the member record.
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists founding_member boolean not null default false,
  add column if not exists founding_number int,
  add column if not exists founding_since  timestamptz,
  -- The grandfathered prices, in cents, frozen at the moment the spot was
  -- claimed. If list pricing moves, these do not.
  add column if not exists founding_rate_basic_cents   int,
  add column if not exists founding_rate_premium_cents int;

create unique index if not exists users_founding_number_unique
  on public.users (founding_number);

-- ---------------------------------------------------------------------------
-- 3) The founding columns are NOT client-writable.
--
-- `users_update_own` (0001) lets a member PATCH their own row, which would
-- otherwise let anyone self-grant a founding spot and pick their own number.
-- This trigger quietly restores the old values for every writer except the
-- claim function below (which sets a transaction-local flag) and service_role.
-- SECURITY INVOKER on purpose: we need `current_user` to be the *caller's*
-- role, not the function owner.
-- ---------------------------------------------------------------------------

create or replace function public.guard_founding_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.founding_claim', true), '') <> 'on'
     and current_user <> 'service_role' then
    new.founding_member             := old.founding_member;
    new.founding_number             := old.founding_number;
    new.founding_since              := old.founding_since;
    new.founding_rate_basic_cents   := old.founding_rate_basic_cents;
    new.founding_rate_premium_cents := old.founding_rate_premium_cents;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_founding_columns()
  from public, anon, authenticated;

drop trigger if exists users_guard_founding on public.users;
create trigger users_guard_founding before update on public.users
  for each row execute function public.guard_founding_columns();

-- ---------------------------------------------------------------------------
-- 4) Claim a spot. Idempotent, capped at 100, and safe under concurrent
--    signups (the advisory lock serializes number assignment).
-- ---------------------------------------------------------------------------

create or replace function public.claim_founding_spot()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cap             constant int := 100;
  basic_cents     constant int := 1500;  -- $15 / pet / mo
  premium_cents   constant int := 2900;  -- $29 / pet / mo
  me              uuid := auth.uid();
  rec             public.users%rowtype;
  next_number     int;
  taken           int;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into rec from public.users where id = me;
  if not found then
    -- handle_new_user() normally creates this row; if it somehow hasn't yet,
    -- report honestly rather than inventing a member.
    return json_build_object('founding', false, 'number', null, 'cap', cap,
                             'claimed', 0, 'full', false);
  end if;

  if rec.founding_member then
    return json_build_object(
      'founding', true, 'number', rec.founding_number, 'cap', cap,
      'claimed', (select count(*) from public.users where founding_member),
      'full', false);
  end if;

  -- Serialize claimants so two simultaneous signups can't take one number.
  perform pg_advisory_xact_lock(hashtext('founding_spot'));

  select count(*) into taken from public.users where founding_member;
  if taken >= cap then
    return json_build_object('founding', false, 'number', null, 'cap', cap,
                             'claimed', taken, 'full', true);
  end if;

  select coalesce(max(founding_number), 0) + 1 into next_number
    from public.users where founding_member;

  perform set_config('app.founding_claim', 'on', true);
  update public.users
     set founding_member             = true,
         founding_number             = next_number,
         founding_since              = now(),
         founding_rate_basic_cents   = basic_cents,
         founding_rate_premium_cents = premium_cents
   where id = me;
  perform set_config('app.founding_claim', 'off', true);

  return json_build_object('founding', true, 'number', next_number, 'cap', cap,
                           'claimed', taken + 1, 'full', false);
end;
$$;

revoke execute on function public.claim_founding_spot() from public, anon;
grant execute on function public.claim_founding_spot() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Public counter for the landing page. Aggregates only — `waitlist` still
--    has no select policy, so this can't be used to enumerate emails.
-- ---------------------------------------------------------------------------

create or replace function public.founding_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'cap',     100,
    'claimed', (select count(*) from public.users where founding_member),
    'waiting', (select count(*) from public.waitlist)
  );
$$;

revoke execute on function public.founding_stats() from public;
grant execute on function public.founding_stats() to anon, authenticated;
