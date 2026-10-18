-- 0019_booking_lockdown.sql
-- bookings_owner_all / travel_bookings_owner_all (0001) let an owner insert or
-- update any column on their own rows: mark a booking confirmed/completed,
-- set their own price and our commission, attach an arbitrary Stripe
-- PaymentIntent id, or point pet_id at someone else's dog.
--
-- Now:
--   * Clients may only insert status = 'requested'.
--   * bookings.amount / commission / currency / vendor_id come from the
--     service row (price less the vendor's member discount; 18% commission).
--     travel_bookings have no price source yet, so they start at 0 and ops
--     quotes them server-side.
--   * Owners can't change status, money, the PaymentIntent id, or which
--     service/vendor a booking is for. They can still edit notes, time, pet.
--   * pet_id must be one of the caller's pets.
--   * Owners can only delete a booking that's still 'requested'.
-- service_role (admin function, Stripe webhook) is unaffected.

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
drop policy if exists bookings_owner_all on public.bookings;

create policy bookings_owner_select on public.bookings
  for select to authenticated using (auth.uid() = user_id);

create policy bookings_owner_insert on public.bookings
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'requested'
    and (
      bookings.pet_id is null
      or exists (
        select 1 from public.pets p
        where p.id = bookings.pet_id and p.owner_id = auth.uid()
      )
    )
  );

create policy bookings_owner_update on public.bookings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      bookings.pet_id is null
      or exists (
        select 1 from public.pets p
        where p.id = bookings.pet_id and p.owner_id = auth.uid()
      )
    )
  );

create policy bookings_owner_delete on public.bookings
  for delete to authenticated
  using (auth.uid() = user_id and status = 'requested');

create or replace function public.guard_booking_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  svc record;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.user_id                  := old.user_id;
    new.service_id               := old.service_id;
    new.vendor_id                := old.vendor_id;
    new.status                   := old.status;
    new.amount                   := old.amount;
    new.commission               := old.commission;
    new.currency                 := old.currency;
    new.stripe_payment_intent_id := old.stripe_payment_intent_id;
    return new;
  end if;

  select s.price, s.currency, s.vendor_id, v.member_discount_pct
    into svc
    from public.services s
    join public.vendors v on v.id = s.vendor_id
   where s.id = new.service_id
     and s.is_active
     and v.status = 'active';
  if not found then
    raise exception 'That service is not available for booking.'
      using errcode = '22023';
  end if;

  new.vendor_id                := svc.vendor_id;
  new.currency                 := svc.currency;
  new.amount                   := round(svc.price * (100 - coalesce(svc.member_discount_pct, 0)) / 100.0, 2);
  new.commission               := round(new.amount * 0.18, 2);
  new.stripe_payment_intent_id := null;
  return new;
end;
$$;

revoke execute on function public.guard_booking_columns() from public, anon, authenticated;

drop trigger if exists bookings_guard_columns on public.bookings;
create trigger bookings_guard_columns
  before insert or update on public.bookings
  for each row execute function public.guard_booking_columns();

-- ---------------------------------------------------------------------------
-- travel_bookings
-- ---------------------------------------------------------------------------
drop policy if exists travel_bookings_owner_all on public.travel_bookings;

create policy travel_bookings_owner_select on public.travel_bookings
  for select to authenticated using (auth.uid() = user_id);

create policy travel_bookings_owner_insert on public.travel_bookings
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'requested'
    and (
      travel_bookings.pet_id is null
      or exists (
        select 1 from public.pets p
        where p.id = travel_bookings.pet_id and p.owner_id = auth.uid()
      )
    )
  );

create policy travel_bookings_owner_update on public.travel_bookings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      travel_bookings.pet_id is null
      or exists (
        select 1 from public.pets p
        where p.id = travel_bookings.pet_id and p.owner_id = auth.uid()
      )
    )
  );

create policy travel_bookings_owner_delete on public.travel_bookings
  for delete to authenticated
  using (auth.uid() = user_id and status = 'requested');

create or replace function public.guard_travel_booking_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.amount     := 0;
      new.commission := 0;
    else
      new.user_id    := old.user_id;
      new.status     := old.status;
      new.amount     := old.amount;
      new.commission := old.commission;
      new.currency   := old.currency;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_travel_booking_columns() from public, anon, authenticated;

drop trigger if exists travel_bookings_guard_columns on public.travel_bookings;
create trigger travel_bookings_guard_columns
  before insert or update on public.travel_bookings
  for each row execute function public.guard_travel_booking_columns();
