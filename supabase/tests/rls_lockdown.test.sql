-- RLS / column-guard regression tests. Run by scripts/test-db.sh against a
-- scratch database that has supabase_stub.sql + every migration applied.
-- Each check raises on failure, so ON_ERROR_STOP turns any miss into a
-- non-zero exit.
\set ON_ERROR_STOP 1
\set QUIET 1

-- ---------------------------------------------------------------------------
-- Harness
-- ---------------------------------------------------------------------------
create function public.t_assert(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'FAIL: %', p_label;
  end if;
  raise notice 'ok: %', p_label;
end $$;

create function public.t_expect_error(p_sql text, p_state text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then
      raise notice 'ok: %', p_label;
      return;
    end if;
    raise exception 'FAIL: % (expected %, got %: %)', p_label, p_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % (expected error %, statement succeeded)', p_label, p_state;
end $$;

create function public.t_login(p_uid uuid, p_email text) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'email', p_email)::text, false);
$$;

create function public.t_service() returns void
language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', false);
$$;

-- Fixtures (as postgres). u1 = vendor owner, u2 = member, u3 = creator.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'vendor@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'member@example.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'creator@example.com');
insert into public.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'vendor@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'member@example.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'creator@example.com')
on conflict (id) do nothing;
insert into public.pets (id, owner_id, name) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'Biscuit'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a3', 'Mochi');

-- ===========================================================================
-- 1) Vendors
-- ===========================================================================
select t_login('00000000-0000-0000-0000-0000000000a1', 'vendor@example.com');
set role authenticated;

insert into public.vendors (id, owner_id, name, category, verified, status, rating, fulfillment, stripe_connect_id)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1',
        'Happy Paws', 'grooming', true, 'active', 5.0, 'in_house', 'acct_forged')
returning id;

select t_assert((select count(*) = 1 from public.my_vendors() where status = 'pending' and not verified
                 and rating is null and fulfillment = 'affiliate' and stripe_connect_id is null),
                'vendor insert: ops columns forced to pending/unverified/affiliate/null');

update public.vendors
   set status = 'active', verified = true, rating = 5, fulfillment = 'in_house',
       stripe_connect_id = 'acct_forged', name = 'Happy Paws Grooming'
 where id = '00000000-0000-0000-0000-0000000000c1';

select t_assert((select count(*) = 1 from public.my_vendors()
                 where name = 'Happy Paws Grooming' and status = 'pending' and not verified
                   and rating is null and fulfillment = 'affiliate' and stripe_connect_id is null),
                'vendor update: owner edits name, ops columns unchanged');

select t_expect_error($$select owner_id from public.vendors$$, '42501', 'vendors.owner_id not selectable by clients');
select t_expect_error($$select stripe_connect_id from public.vendors$$, '42501', 'vendors.stripe_connect_id not selectable by clients');
select t_expect_error($$select * from public.vendors$$, '42501', 'select * on vendors denied (hidden columns)');

select t_expect_error(
  $$insert into public.posts (author_id, kind, vendor_id, caption)
    values ('00000000-0000-0000-0000-0000000000a1', 'vendor', '00000000-0000-0000-0000-0000000000c1', 'promo')$$,
  '42501', 'vendor post rejected while vendor is pending');

insert into public.services (id, vendor_id, title, price)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Full groom', 100.00);
select t_assert(true, 'owner can add services to own vendor');
reset role;

-- Other members: pending listing invisible; can't attach services to it.
select t_login('00000000-0000-0000-0000-0000000000a2', 'member@example.com');
set role authenticated;
select t_assert((select count(*) = 0 from public.vendors where id = '00000000-0000-0000-0000-0000000000c1'),
                'pending vendor hidden from other members');
select t_assert((select count(*) = 0 from public.my_vendors()), 'my_vendors() only returns own rows');
select t_expect_error(
  $$insert into public.services (vendor_id, title, price)
    values ('00000000-0000-0000-0000-0000000000c1', 'Spoofed', 1)$$,
  '42501', 'non-owner cannot add services to a vendor');
reset role;

-- Ops activates the vendor and sets a 10% member discount.
select t_service();
set role service_role;
update public.vendors set status = 'active', verified = true, member_discount_pct = 10
 where id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select t_assert((select status = 'active' and verified from public.vendors
                 where id = '00000000-0000-0000-0000-0000000000c1'),
                'service_role can activate/verify a vendor');

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select t_assert((select count(*) >= 1 from public.vendors where id = '00000000-0000-0000-0000-0000000000c1'),
                'anon can read active catalog columns');
select t_assert((select count(*) >= 1 from public.services where vendor_id = '00000000-0000-0000-0000-0000000000c1'),
                'anon can read services');
reset role;

select t_login('00000000-0000-0000-0000-0000000000a1', 'vendor@example.com');
set role authenticated;
select t_expect_error(
  $$insert into public.posts (author_id, kind, vendor_id, caption, link_url)
    values ('00000000-0000-0000-0000-0000000000a1', 'vendor', '00000000-0000-0000-0000-0000000000c1', 'promo', 'http://shop.example.com')$$,
  '23514', 'vendor post link_url must be https (http rejected)');
select t_expect_error(
  $$insert into public.posts (author_id, kind, vendor_id, caption, link_url)
    values ('00000000-0000-0000-0000-0000000000a1', 'vendor', '00000000-0000-0000-0000-0000000000c1', 'promo', 'javascript:alert(1)')$$,
  '23514', 'vendor post link_url must be https (javascript: rejected)');
insert into public.posts (id, author_id, kind, vendor_id, vendor_name, caption, link_url)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'vendor',
        '00000000-0000-0000-0000-0000000000c1', 'Some Other Brand', 'promo', 'https://shop.example.com/sale');
select t_assert((select vendor_name = 'Happy Paws Grooming' from public.posts
                 where id = '00000000-0000-0000-0000-0000000000e1'),
                'vendor post allowed once active; vendor_name stamped from vendor row');
reset role;

select t_login('00000000-0000-0000-0000-0000000000a2', 'member@example.com');
set role authenticated;
select t_expect_error(
  $$insert into public.posts (author_id, kind, vendor_id, caption)
    values ('00000000-0000-0000-0000-0000000000a2', 'vendor', '00000000-0000-0000-0000-0000000000c1', 'fake ad')$$,
  '42501', 'member cannot post as someone else''s vendor');
select t_expect_error(
  $$insert into public.posts (author_id, kind, vendor_id, caption)
    values ('00000000-0000-0000-0000-0000000000a2', 'member', '00000000-0000-0000-0000-0000000000c1', 'sneaky')$$,
  '42501', 'member post cannot carry a vendor_id');
insert into public.posts (id, author_id, caption)
values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2', 'my dog');
select t_expect_error(
  $$update public.posts set kind = 'vendor', vendor_id = '00000000-0000-0000-0000-0000000000c1'
    where id = '00000000-0000-0000-0000-0000000000e2'$$,
  '42501', 'member post cannot be flipped into a vendor post');
reset role;

-- ===========================================================================
-- 2) users billing columns
-- ===========================================================================
select t_login('00000000-0000-0000-0000-0000000000a2', 'member@example.com');
set role authenticated;
update public.users
   set membership_tier = 'premium', stripe_customer_id = 'cus_someone_else',
       email = 'victim@example.com', name = 'Brandon'
 where id = '00000000-0000-0000-0000-0000000000a2';
select t_assert((select membership_tier is null and stripe_customer_id is null
                        and email = 'member@example.com' and name = 'Brandon'
                   from public.users where id = '00000000-0000-0000-0000-0000000000a2'),
                'users: tier/customer/email reverted, name editable');
reset role;

select t_service();
set role service_role;
update public.users set membership_tier = 'premium', stripe_customer_id = 'cus_real'
 where id = '00000000-0000-0000-0000-0000000000a2';
reset role;
select t_assert((select membership_tier = 'premium' and stripe_customer_id = 'cus_real'
                   from public.users where id = '00000000-0000-0000-0000-0000000000a2'),
                'users: service_role can set tier/customer');

-- ===========================================================================
-- 3) bookings / travel_bookings
-- ===========================================================================
select t_login('00000000-0000-0000-0000-0000000000a2', 'member@example.com');
set role authenticated;
select t_expect_error(
  $$insert into public.bookings (user_id, service_id, status)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1', 'confirmed')$$,
  '42501', 'booking insert with status confirmed rejected');
select t_expect_error(
  $$insert into public.bookings (user_id, pet_id, service_id, status)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3',
            '00000000-0000-0000-0000-0000000000d1', 'requested')$$,
  '42501', 'booking for a pet the caller does not own rejected');
insert into public.bookings (id, user_id, pet_id, service_id, vendor_id, status, amount, commission, currency, stripe_payment_intent_id)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2',
        '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1',
        '11111111-1111-1111-1111-111111111111', 'requested', 1.00, 0, 'eur', 'pi_forged');
select t_assert((select amount = 90.00 and commission = 16.20 and currency = 'usd'
                        and stripe_payment_intent_id is null
                        and vendor_id = '00000000-0000-0000-0000-0000000000c1'
                   from public.bookings where id = '00000000-0000-0000-0000-0000000000f1'),
                'booking money/vendor derived from service (100 - 10% = 90, 18% = 16.20)');

update public.bookings
   set status = 'completed', amount = 0, commission = 0, stripe_payment_intent_id = 'pi_forged',
       notes = 'gate code 1234'
 where id = '00000000-0000-0000-0000-0000000000f1';
select t_assert((select status = 'requested' and amount = 90.00 and commission = 16.20
                        and stripe_payment_intent_id is null and notes = 'gate code 1234'
                   from public.bookings where id = '00000000-0000-0000-0000-0000000000f1'),
                'booking update: status/money/PI reverted, notes editable');
select t_expect_error(
  $$update public.bookings set pet_id = '00000000-0000-0000-0000-0000000000b3'
    where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '42501', 'booking cannot be moved to a pet the caller does not own');
reset role;

-- Pending vendor's service is not bookable.
select t_service();
set role service_role;
insert into public.vendors (id, name, category, status)
values ('00000000-0000-0000-0000-0000000000c2', 'Paused Co', 'walking', 'paused');
insert into public.services (id, vendor_id, title, price)
values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 'Walk', 30);
update public.bookings set status = 'confirmed', stripe_payment_intent_id = 'pi_real'
 where id = '00000000-0000-0000-0000-0000000000f1';
reset role;
select t_assert((select status = 'confirmed' and stripe_payment_intent_id = 'pi_real'
                   from public.bookings where id = '00000000-0000-0000-0000-0000000000f1'),
                'booking: service_role can confirm and attach PI');

select t_login('00000000-0000-0000-0000-0000000000a2', 'member@example.com');
set role authenticated;
select t_expect_error(
  $$insert into public.bookings (user_id, service_id, status)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d2', 'requested')$$,
  '22023', 'booking a service of a non-active vendor rejected');
select t_expect_error(
  $$insert into public.bookings (user_id, status) values ('00000000-0000-0000-0000-0000000000a2', 'requested')$$,
  '22023', 'booking without a service rejected');
delete from public.bookings where id = '00000000-0000-0000-0000-0000000000f1';
select t_assert((select count(*) = 1 from public.bookings where id = '00000000-0000-0000-0000-0000000000f1'),
                'confirmed booking cannot be deleted by owner');

select t_expect_error(
  $$insert into public.travel_bookings (user_id, status) values ('00000000-0000-0000-0000-0000000000a2', 'confirmed')$$,
  '42501', 'travel booking insert with status confirmed rejected');
select t_expect_error(
  $$insert into public.travel_bookings (user_id, pet_id, status)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3', 'requested')$$,
  '42501', 'travel booking for another member''s pet rejected');
insert into public.travel_bookings (id, user_id, pet_id, status, amount, commission, destination)
values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a2',
        '00000000-0000-0000-0000-0000000000b2', 'requested', 500, 90, 'Denver');
update public.travel_bookings set status = 'confirmed', amount = 1, destination = 'Austin'
 where id = '00000000-0000-0000-0000-0000000000f2';
select t_assert((select status = 'requested' and amount = 0 and commission = 0 and destination = 'Austin'
                   from public.travel_bookings where id = '00000000-0000-0000-0000-0000000000f2'),
                'travel booking: money zeroed on insert, status/money locked on update');
reset role;

-- ===========================================================================
-- 4) Creator deals
-- ===========================================================================
select t_login('00000000-0000-0000-0000-0000000000a1', 'vendor@example.com');
set role authenticated;
insert into public.campaigns (id, vendor_id, title, payout_per_post, status) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000c1', 'Summer', 200, 'open'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-0000000000c1', 'Old', 50, 'closed');
reset role;

select t_login('00000000-0000-0000-0000-0000000000a3', 'creator@example.com');
set role authenticated;
select t_expect_error(
  $$insert into public.campaign_deals (campaign_id, creator_id, status)
    values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000a3', 'paid')$$,
  '42501', 'creator cannot insert a deal as paid');
select t_expect_error(
  $$insert into public.campaign_deals (campaign_id, creator_id, status)
    values ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-0000000000a3', 'applied')$$,
  '42501', 'creator cannot apply to a closed campaign');
insert into public.campaign_deals (id, campaign_id, creator_id, creator_handle, status, payout, commission)
values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-0000000000a3', 'mochi', 'applied', 9999, 0);
select t_assert((select payout = 200 and commission = 36 from public.campaign_deals
                  where id = '00000000-0000-0000-0000-000000000201'),
                'deal payout/commission copied from campaign');
update public.campaign_deals set status = 'accepted', payout = 5000
 where id = '00000000-0000-0000-0000-000000000201';
select t_assert((select status = 'applied' and payout = 200 from public.campaign_deals
                  where id = '00000000-0000-0000-0000-000000000201'),
                'creator cannot change deal status or payout');
select t_assert(not public.mark_deal_delivered('00000000-0000-0000-0000-000000000201'),
                'creator cannot mark an un-accepted deal delivered');
reset role;

select t_login('00000000-0000-0000-0000-0000000000a1', 'vendor@example.com');
set role authenticated;
update public.campaign_deals set status = 'paid' where id = '00000000-0000-0000-0000-000000000201';
select t_assert((select status = 'applied' from public.campaign_deals
                  where id = '00000000-0000-0000-0000-000000000201'),
                'vendor cannot jump a deal to paid');
update public.campaign_deals set status = 'accepted', commission = 0
 where id = '00000000-0000-0000-0000-000000000201';
select t_assert((select status = 'accepted' and commission = 36 from public.campaign_deals
                  where id = '00000000-0000-0000-0000-000000000201'),
                'vendor can accept; commission unchanged');
reset role;

select t_login('00000000-0000-0000-0000-0000000000a3', 'creator@example.com');
set role authenticated;
select t_assert(public.mark_deal_delivered('00000000-0000-0000-0000-000000000201'),
                'creator marks accepted deal delivered via RPC');
reset role;

select t_login('00000000-0000-0000-0000-0000000000a1', 'vendor@example.com');
set role authenticated;
update public.campaign_deals set status = 'paid' where id = '00000000-0000-0000-0000-000000000201';
select t_assert((select status = 'delivered' from public.campaign_deals
                  where id = '00000000-0000-0000-0000-000000000201'),
                'vendor cannot mark a delivered deal paid');
reset role;

select t_service();
set role service_role;
update public.campaign_deals set status = 'paid' where id = '00000000-0000-0000-0000-000000000201';
reset role;
select t_assert((select status = 'paid' from public.campaign_deals
                  where id = '00000000-0000-0000-0000-000000000201'),
                'service_role can mark a deal paid');

-- ===========================================================================
-- 6) AI quota
-- ===========================================================================
select t_login('00000000-0000-0000-0000-0000000000a2', 'member@example.com');
set role authenticated;
select t_expect_error(
  $$select public.consume_ai_quota('00000000-0000-0000-0000-0000000000a2', 'ai-chat', 100, 60)$$,
  '42501', 'clients cannot call consume_ai_quota');
select t_expect_error($$select * from public.ai_usage_events$$, '42501', 'clients cannot read ai_usage_events');
reset role;

select t_service();
set role service_role;
select t_assert(public.consume_ai_quota('00000000-0000-0000-0000-0000000000a2', 't', 2, 60), 'quota hit 1 allowed');
select t_assert(public.consume_ai_quota('00000000-0000-0000-0000-0000000000a2', 't', 2, 60), 'quota hit 2 allowed');
select t_assert(not public.consume_ai_quota('00000000-0000-0000-0000-0000000000a2', 't', 2, 60), 'quota hit 3 blocked');
select t_assert(public.consume_ai_quota('00000000-0000-0000-0000-0000000000a3', 't', 2, 60), 'quota is per user');
reset role;

\echo 'All RLS lockdown tests passed.'
