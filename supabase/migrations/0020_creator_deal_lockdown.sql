-- 0020_creator_deal_lockdown.sql
-- campaign_deals (0008) let a creator insert a deal already 'accepted'/'paid'
-- with any payout, and either party could later rewrite status or money —
-- including a vendor marking a deal 'paid' that PackHub never paid out.
--
-- Now:
--   * Creators insert only status = 'applied', on an open campaign; payout
--     and commission are copied from the campaign (18% commission).
--   * Nobody on the client side can change payout/commission/campaign/creator.
--   * Status moves are a fixed state machine:
--       vendor:  applied -> accepted | declined     (direct update)
--       creator: accepted -> delivered              (mark_deal_delivered())
--       ops:     delivered -> paid                  (service role only)
--   * Creators can withdraw (delete) an application only while 'applied'.

drop policy if exists deals_insert_creator on public.campaign_deals;
create policy deals_insert_creator on public.campaign_deals
  for insert to authenticated
  with check (
    creator_id = auth.uid()
    and status = 'applied'
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_deals.campaign_id and c.status = 'open'
    )
  );

drop policy if exists deals_delete_creator on public.campaign_deals;
create policy deals_delete_creator on public.campaign_deals
  for delete to authenticated
  using (creator_id = auth.uid() and status = 'applied');

create or replace function public.guard_deal_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  campaign_payout numeric(10, 2);
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select c.payout_per_post into campaign_payout
      from public.campaigns c where c.id = new.campaign_id;
    new.payout     := coalesce(campaign_payout, 0);
    new.commission := round(new.payout * 0.18, 2);
    return new;
  end if;

  new.campaign_id := old.campaign_id;
  new.creator_id  := old.creator_id;
  new.payout      := old.payout;
  new.commission  := old.commission;

  if new.status is distinct from old.status
     and not (
       old.status = 'applied'
       and new.status in ('accepted', 'declined')
       and public.owns_campaign(old.campaign_id)
     ) then
    new.status := old.status;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_deal_columns() from public, anon, authenticated;

drop trigger if exists deals_guard_columns on public.campaign_deals;
create trigger deals_guard_columns
  before insert or update on public.campaign_deals
  for each row execute function public.guard_deal_columns();

-- The one status move a creator makes. SECURITY DEFINER, so it bypasses the
-- client guard above — which is why it hard-codes the allowed transition.
create or replace function public.mark_deal_delivered(p_deal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.campaign_deals
     set status = 'delivered'
   where id = p_deal_id
     and creator_id = auth.uid()
     and status = 'accepted';
  return found;
end;
$$;

revoke execute on function public.mark_deal_delivered(uuid) from public, anon;
grant execute on function public.mark_deal_delivered(uuid) to authenticated;
