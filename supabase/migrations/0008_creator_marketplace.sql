-- 0008_creator_marketplace.sql
-- Creator marketplace: influencers make content; paying vendors run campaigns;
-- PackHub brokers the deals and takes a commission.

-- 1) Creator profiles --------------------------------------------------------
create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  handle text not null default '',
  bio text not null default '',
  niche text,
  breeds text[] not null default '{}',
  instagram text,
  tiktok text,
  youtube text,
  follower_count int not null default 0,
  rate_per_post numeric(10,2),
  status text not null default 'active' check (status in ('active','paused')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.creator_profiles enable row level security;
create policy creator_read on public.creator_profiles
  for select to authenticated using (status = 'active' or user_id = auth.uid());
create policy creator_insert_own on public.creator_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy creator_update_own on public.creator_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy creator_delete_own on public.creator_profiles
  for delete to authenticated using (user_id = auth.uid());

-- Only the service role can grant the verified badge.
create or replace function public.lock_creator_verified()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    if tg_op = 'INSERT' then new.verified := false;
    elsif tg_op = 'UPDATE' then new.verified := old.verified;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists creator_lock_verified on public.creator_profiles;
create trigger creator_lock_verified before insert or update on public.creator_profiles
  for each row execute function public.lock_creator_verified();
create trigger creator_set_updated_at before update on public.creator_profiles
  for each row execute function public.set_updated_at();
revoke execute on function public.lock_creator_verified() from public, anon, authenticated;

-- 2) Brand campaigns ---------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_name text not null default '',
  title text not null,
  brief text not null default '',
  payout_per_post numeric(10,2) not null default 0,
  budget numeric(10,2),
  target_breed text,
  target_life_stage text check (target_life_stage in ('puppy','adolescent','adult','senior')),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create policy campaigns_read on public.campaigns
  for select to authenticated using (
    status = 'open'
    or exists (select 1 from public.vendors v where v.id = campaigns.vendor_id and v.owner_id = auth.uid())
  );
create policy campaigns_write_owner on public.campaigns
  for all to authenticated using (
    exists (select 1 from public.vendors v where v.id = campaigns.vendor_id and v.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.vendors v where v.id = campaigns.vendor_id and v.owner_id = auth.uid())
  );
create trigger campaigns_set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- 3) Deals connecting a creator to a campaign --------------------------------
create table if not exists public.campaign_deals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_handle text not null default '',
  status text not null default 'applied'
    check (status in ('applied','accepted','delivered','paid','declined')),
  payout numeric(10,2) not null default 0,
  commission numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
alter table public.campaign_deals enable row level security;
create policy deals_read on public.campaign_deals
  for select to authenticated using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      join public.vendors v on v.id = c.vendor_id
      where c.id = campaign_deals.campaign_id and v.owner_id = auth.uid()
    )
  );
create policy deals_insert_creator on public.campaign_deals
  for insert to authenticated with check (creator_id = auth.uid());
-- WITH CHECK mirrors USING so neither party can reassign a deal.
create policy deals_update_party on public.campaign_deals
  for update to authenticated using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      join public.vendors v on v.id = c.vendor_id
      where c.id = campaign_deals.campaign_id and v.owner_id = auth.uid()
    )
  ) with check (
    creator_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      join public.vendors v on v.id = c.vendor_id
      where c.id = campaign_deals.campaign_id and v.owner_id = auth.uid()
    )
  );
create policy deals_delete_creator on public.campaign_deals
  for delete to authenticated using (creator_id = auth.uid());
create trigger deals_set_updated_at before update on public.campaign_deals
  for each row execute function public.set_updated_at();

create index if not exists campaigns_open_idx on public.campaigns (status, created_at desc);
create index if not exists deals_creator_idx on public.campaign_deals (creator_id, status);
