-- 0017_vendor_lockdown.sql
-- Vendors could PATCH their own row into verified/active/in-house with a
-- self-chosen rating and Stripe Connect account (vendors_owner_write, 0001),
-- and the public catalog exposed owner_id + stripe_connect_id to everyone.
--
--   * verified / status / rating / fulfillment / stripe_connect_id / owner_id
--     are now service-role only (trigger, same idea as sitters/creators).
--   * New listings start 'pending' and only appear once ops activates them.
--   * Catalog reads are column-scoped: clients can't select owner_id or
--     stripe_connect_id at all. Owners load their own rows via my_vendors().
--   * Sponsored feed posts require an *active* vendor you own, and link_url
--     must be https.
--
-- Client-role detection: these guards are SECURITY INVOKER and check
-- current_user, which is the PostgREST role (anon/authenticated) for API
-- calls. service_role, the dashboard SQL editor (postgres) and SECURITY
-- DEFINER functions are trusted and pass through untouched.

-- Columns that exist in production (added outside the repo) — make the repo
-- schema match so fresh environments get them too.
alter table public.vendors
  add column if not exists member_discount_pct integer not null default 0,
  add column if not exists zip text,
  add column if not exists serves_anywhere boolean not null default false;

alter table public.vendors
  drop constraint if exists vendors_member_discount_pct_range;
alter table public.vendors
  add constraint vendors_member_discount_pct_range
  check (member_discount_pct between 0 and 100);

alter table public.vendors alter column status set default 'pending';

-- ---------------------------------------------------------------------------
-- 1) Ops-controlled vendor columns
-- ---------------------------------------------------------------------------
create or replace function public.guard_vendor_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.owner_id          := auth.uid();
      new.verified          := false;
      new.status            := 'pending';
      new.rating            := null;
      new.fulfillment       := 'affiliate';
      new.stripe_connect_id := null;
    else
      new.owner_id          := old.owner_id;
      new.verified          := old.verified;
      new.status            := old.status;
      new.rating            := old.rating;
      new.fulfillment       := old.fulfillment;
      new.stripe_connect_id := old.stripe_connect_id;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_vendor_columns() from public, anon, authenticated;

drop trigger if exists vendors_guard_columns on public.vendors;
create trigger vendors_guard_columns
  before insert or update on public.vendors
  for each row execute function public.guard_vendor_columns();

-- ---------------------------------------------------------------------------
-- 2) Catalog visibility: active listings for everyone, your own for you.
-- ---------------------------------------------------------------------------
drop policy if exists vendors_public_read on public.vendors;
drop policy if exists vendors_owner_write on public.vendors;

create policy vendors_catalog_read on public.vendors
  for select using (status = 'active' or owner_id = auth.uid());
create policy vendors_owner_insert on public.vendors
  for insert to authenticated with check (owner_id = auth.uid());
create policy vendors_owner_update on public.vendors
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy vendors_owner_delete on public.vendors
  for delete to authenticated using (owner_id = auth.uid());

-- Column-level read grant. NOTE: a column added to vendors later is NOT
-- client-readable until it's added to this list.
revoke select on public.vendors from anon, authenticated;
grant select (
  id, name, category, description, location, verified, fulfillment, rating,
  status, member_discount_pct, zip, serves_anywhere, created_at, updated_at
) on public.vendors to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Ownership helpers. Policies on other tables can't read vendors.owner_id
--    any more (no column grant), so they go through these instead.
-- ---------------------------------------------------------------------------
create or replace function public.owns_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vendors v
    where v.id = p_vendor_id and v.owner_id = auth.uid()
  );
$$;

create or replace function public.owns_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    join public.vendors v on v.id = c.vendor_id
    where c.id = p_campaign_id and v.owner_id = auth.uid()
  );
$$;

create or replace function public.can_post_as_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vendors v
    where v.id = p_vendor_id and v.owner_id = auth.uid() and v.status = 'active'
  );
$$;

revoke execute on function public.owns_vendor(uuid) from public;
revoke execute on function public.owns_campaign(uuid) from public;
revoke execute on function public.can_post_as_vendor(uuid) from public;
grant execute on function public.owns_vendor(uuid) to anon, authenticated;
grant execute on function public.owns_campaign(uuid) to anon, authenticated;
grant execute on function public.can_post_as_vendor(uuid) to authenticated;

-- The signed-in owner's listings, all columns, any status.
create or replace function public.my_vendors()
returns setof public.vendors
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.vendors
  where owner_id = auth.uid()
  order by created_at desc;
$$;

revoke execute on function public.my_vendors() from public, anon;
grant execute on function public.my_vendors() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Re-point policies that read vendors.owner_id directly.
-- ---------------------------------------------------------------------------
drop policy if exists services_vendor_owner_write on public.services;
create policy services_vendor_owner_write on public.services
  for all to authenticated
  using (public.owns_vendor(vendor_id))
  with check (public.owns_vendor(vendor_id));

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns
  for select to authenticated
  using (status = 'open' or public.owns_vendor(vendor_id));

drop policy if exists campaigns_write_owner on public.campaigns;
create policy campaigns_write_owner on public.campaigns
  for all to authenticated
  using (public.owns_vendor(vendor_id))
  with check (public.owns_vendor(vendor_id));

drop policy if exists deals_read on public.campaign_deals;
create policy deals_read on public.campaign_deals
  for select to authenticated
  using (creator_id = auth.uid() or public.owns_campaign(campaign_id));

drop policy if exists deals_update_party on public.campaign_deals;
create policy deals_update_party on public.campaign_deals
  for update to authenticated
  using (creator_id = auth.uid() or public.owns_campaign(campaign_id))
  with check (creator_id = auth.uid() or public.owns_campaign(campaign_id));

-- ---------------------------------------------------------------------------
-- 5) Sponsored feed posts
-- ---------------------------------------------------------------------------
-- Member posts can't carry a vendor; vendor posts need an active vendor you
-- own. Update gets the same check so a member post can't be flipped into a
-- sponsored one (or onto someone else's vendor) after the fact.
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and (
      (kind = 'member' and vendor_id is null)
      or (kind = 'vendor' and public.can_post_as_vendor(vendor_id))
    )
  );

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
  for update to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and (
      (kind = 'member' and vendor_id is null)
      or (kind = 'vendor' and public.can_post_as_vendor(vendor_id))
    )
  );

alter table public.posts drop constraint if exists posts_link_url_https;
alter table public.posts
  add constraint posts_link_url_https
  check (
    link_url is null
    or (link_url ~* '^https://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
        and char_length(link_url) <= 2048)
  );

-- The sponsor label always reflects the real vendor, not client-supplied text.
create or replace function public.stamp_vendor_post_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'vendor' and new.vendor_id is not null then
    select v.name into new.vendor_name from public.vendors v where v.id = new.vendor_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_vendor_post_name() from public, anon, authenticated;

drop trigger if exists posts_stamp_vendor_name on public.posts;
create trigger posts_stamp_vendor_name
  before insert or update on public.posts
  for each row execute function public.stamp_vendor_post_name();
