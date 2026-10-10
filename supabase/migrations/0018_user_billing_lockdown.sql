-- 0018_user_billing_lockdown.sql
-- users_update_own / users_insert_own (0001) let a member write any column of
-- their own row, including:
--   * membership_tier    — self-upgrade to premium without paying.
--   * stripe_customer_id — point create-checkout at someone else's Stripe
--                          customer (their saved cards, their invoices).
--   * email              — add-friend resolves members by this column, and
--                          it's unique, so squatting another person's address
--                          both hijacks their friend requests and breaks their
--                          signup (handle_new_user would hit the constraint).
--
-- Same pattern as the founding columns (0015): only service_role (the Stripe
-- webhook / create-checkout) and trusted server code may set these. Client
-- roles get their writes quietly reverted.

create or replace function public.guard_user_billing_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.membership_tier    := null;
      new.stripe_customer_id := null;
      new.email              := coalesce(nullif(auth.jwt() ->> 'email', ''), new.email);
    else
      new.membership_tier    := old.membership_tier;
      new.stripe_customer_id := old.stripe_customer_id;
      new.email              := old.email;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_user_billing_columns()
  from public, anon, authenticated;

drop trigger if exists users_guard_billing on public.users;
create trigger users_guard_billing
  before insert or update on public.users
  for each row execute function public.guard_user_billing_columns();
