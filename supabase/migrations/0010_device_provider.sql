-- 0010_device_provider.sql
-- Link a device to an external tracker provider (e.g. Tractive) so we can sync
-- its data in until the PackHub Band exists. The token is the owner's own
-- provider session, readable only by them (devices RLS) and the service role.
alter table public.devices
  add column if not exists provider text not null default 'packhub',
  add column if not exists external_user_id text,
  add column if not exists external_tracker_id text,
  add column if not exists external_token text,
  add column if not exists external_token_expires timestamptz;
