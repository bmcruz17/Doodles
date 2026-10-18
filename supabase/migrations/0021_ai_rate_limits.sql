-- 0021_ai_rate_limits.sql
-- Per-user sliding-window rate limit for the Claude-backed Edge Functions
-- (ai-chat, device-insights, parse-records). Each call to consume_ai_quota()
-- records one hit and returns false once the caller is over the limit.
--
-- Service role only: the functions call it after authenticating the user, so
-- a client can't burn (or reset) anyone else's quota.

create table if not exists public.ai_usage_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  bucket     text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_lookup_idx
  on public.ai_usage_events (user_id, bucket, created_at desc);

-- RLS on with no policies: invisible to anon/authenticated.
alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from anon, authenticated;

create or replace function public.consume_ai_quota(
  p_user_id        uuid,
  p_bucket         text,
  p_max            int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz := now() - make_interval(secs => p_window_seconds);
  used         int;
begin
  -- Serialize per user+bucket so concurrent requests can't all slip under.
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || p_user_id::text || ':' || p_bucket));

  delete from public.ai_usage_events
   where user_id = p_user_id and bucket = p_bucket and created_at < window_start;

  select count(*) into used
    from public.ai_usage_events
   where user_id = p_user_id and bucket = p_bucket;

  if used >= p_max then
    return false;
  end if;

  insert into public.ai_usage_events (user_id, bucket) values (p_user_id, p_bucket);
  return true;
end;
$$;

revoke execute on function public.consume_ai_quota(uuid, text, int, int)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, int, int) to service_role;
