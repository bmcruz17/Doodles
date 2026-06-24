-- 0009_wearables.sql
-- Wearable "device cloud": registered devices, daily vitals summaries, and
-- AI-generated health alerts. Owner-scoped via pet ownership. Real hardware
-- pushes telemetry through the device-ingest function using its ingest_key.

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'PackHub Band',
  kind text not null default 'packhub_band',
  serial text,
  ingest_key uuid not null default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','inactive')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.devices enable row level security;
create policy devices_owner_all on public.devices
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.device_daily (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  day date not null,
  steps int, distance_m int, active_minutes int, rest_minutes int,
  sleep_minutes int, avg_heart_rate int, avg_resp_rate int,
  water_ml int, food_g int, scratch_events int,
  limp_score numeric(3,2), play_minutes int,
  created_at timestamptz not null default now(),
  unique (pet_id, day)
);
alter table public.device_daily enable row level security;
create policy device_daily_owner on public.device_daily
  for all to authenticated
  using (exists (select 1 from public.pets p where p.id = device_daily.pet_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.pets p where p.id = device_daily.pet_id and p.owner_id = auth.uid()));

create table if not exists public.device_alerts (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  severity text not null default 'info' check (severity in ('info','watch','urgent')),
  title text not null,
  detail text not null default '',
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.device_alerts enable row level security;
create policy device_alerts_owner on public.device_alerts
  for all to authenticated
  using (exists (select 1 from public.pets p where p.id = device_alerts.pet_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.pets p where p.id = device_alerts.pet_id and p.owner_id = auth.uid()));

create index if not exists device_daily_pet_idx on public.device_daily (pet_id, day desc);
create index if not exists device_alerts_pet_idx on public.device_alerts (pet_id, created_at desc);
