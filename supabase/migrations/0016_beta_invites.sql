-- 0016_beta_invites.sql
-- Closing the waitlist loop: track who has been welcomed and who has been
-- invited, so sends are idempotent and the admin board can work the queue.
--
-- No email body or passcode lives here — the Edge Function owns that. These
-- columns exist so a retry, a double-submit, or a second click of "send
-- invites" can never mail the same person twice.

alter table public.waitlist
  -- Set when the "you're on the list" confirmation went out.
  add column if not exists welcomed_at timestamptz,
  -- Set when the beta invite (with the passcode) went out.
  add column if not exists invited_at  timestamptz,
  -- Which cohort they were invited in, for later segmenting.
  add column if not exists invite_batch text;

-- Working the queue is always "oldest un-invited first", so index for it.
create index if not exists waitlist_uninvited_idx
  on public.waitlist (created_at)
  where invited_at is null;

-- The client may insert itself onto the waitlist (0012) but must never be able
-- to mark itself welcomed or invited — that would let someone silence their own
-- invite, or make the admin board think a cohort went out when it didn't.
-- Same pattern as the founding columns in 0015: service_role only.
create or replace function public.guard_waitlist_delivery()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    new.welcomed_at  := old.welcomed_at;
    new.invited_at   := old.invited_at;
    new.invite_batch := old.invite_batch;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_waitlist_delivery()
  from public, anon, authenticated;

create trigger waitlist_guard_delivery before update on public.waitlist
  for each row execute function public.guard_waitlist_delivery();
