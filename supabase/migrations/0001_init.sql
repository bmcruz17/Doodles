-- =============================================================================
-- Doodle Platform — initial schema (Phase 1)
-- Postgres + Supabase Auth + Storage + Row Level Security.
--
-- Source of truth for the schema. Mirrors the core tables in the business plan
-- (§7.2) and CLAUDE.md: users, pets, health_records, vaccinations, vendors,
-- services, bookings, subscriptions, travel_bookings, ai_conversations.
--
-- RLS model:
--   * Owner-scoped tables key off auth.uid().
--   * pets.owner_id, bookings.user_id, subscriptions.user_id,
--     travel_bookings.user_id reference users(id) directly.
--   * health_records / vaccinations / ai_conversations have no user column;
--     they are scoped through their parent pet's owner via an EXISTS check.
--   * vendors / services are a public catalog (world-readable).
--
-- JSONB caution (carried over from Risen Recruit): Supabase can silently drop
-- very large JSONB. Keep pets.ai_profile and ai_conversations.messages bounded;
-- paginate/offload if they grow.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — owner profile, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text not null unique,
  name               text,
  phone              text,
  membership_tier    text check (membership_tier in ('basic', 'premium')),
  stripe_customer_id text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Auto-create a profile row whenever an auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- pets — the heart of the data model
-- ---------------------------------------------------------------------------
create table public.pets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.users (id) on delete cascade,
  name         text not null,
  breed        text,                          -- 'mini_goldendoodle', 'saint_berdoodle', ...
  doodle_type  text,                          -- 'goldendoodle', 'bernedoodle', ...
  birthdate    date,
  weight_lbs   numeric(6, 2),
  coat_type    text,                          -- 'wavy', 'curly', 'straight'
  sex          text check (sex in ('male', 'female', 'unknown')),
  photo_url    text,
  ai_profile   jsonb not null default '{}'::jsonb,  -- learned traits, preferences, baselines
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index pets_owner_id_idx on public.pets (owner_id);

-- ---------------------------------------------------------------------------
-- health_records — vet visits, meds, allergies, weight logs (data jsonb)
-- ---------------------------------------------------------------------------
create table public.health_records (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets (id) on delete cascade,
  record_type  text not null default 'vet_visit'
                 check (record_type in
                   ('vet_visit', 'medication', 'allergy', 'weight_log',
                    'lab_result', 'note')),
  data         jsonb not null default '{}'::jsonb,  -- { title, notes, ... }
  document_url text,                                -- scanned record in Storage
  recorded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index health_records_pet_id_idx on public.health_records (pet_id);

-- ---------------------------------------------------------------------------
-- vaccinations
-- ---------------------------------------------------------------------------
create table public.vaccinations (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references public.pets (id) on delete cascade,
  vaccine         text not null,              -- 'rabies', 'DHPP', 'FAVN_titer', ...
  administered_at date not null,
  expires_at      date,
  veterinarian    text,
  certificate_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index vaccinations_pet_id_idx on public.vaccinations (pet_id);

-- ---------------------------------------------------------------------------
-- vendors — marketplace providers (public catalog)
-- ---------------------------------------------------------------------------
create table public.vendors (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid references public.users (id) on delete set null,
  name               text not null,
  category           text not null
                       check (category in
                         ('grooming', 'mobile_vet', 'food', 'insurance',
                          'sitter', 'specialist', 'travel', 'supplies', 'other')),
  description        text,
  location           text,                    -- free-text city/region for Phase 1
  doodle_specialist  boolean not null default false,
  rating             numeric(2, 1),
  status             text not null default 'active'
                       check (status in ('active', 'pending', 'paused')),
  stripe_connect_id  text,                    -- Stripe Connect account (Phase 2 payouts)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index vendors_category_idx on public.vendors (category);

-- ---------------------------------------------------------------------------
-- services — offerings from a vendor (public catalog)
-- ---------------------------------------------------------------------------
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors (id) on delete cascade,
  title         text not null,
  description   text,
  price         numeric(10, 2) not null default 0,  -- dollars
  currency      text not null default 'usd',
  recurring     boolean not null default false,
  interval      text check (interval in ('once', 'week', 'month', 'year')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index services_vendor_id_idx on public.services (vendor_id);

-- ---------------------------------------------------------------------------
-- bookings — a user booking a service (18% commission split)
-- ---------------------------------------------------------------------------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  pet_id        uuid references public.pets (id) on delete set null,
  service_id    uuid references public.services (id) on delete set null,
  vendor_id     uuid references public.vendors (id) on delete set null,
  scheduled_for timestamptz,
  status        text not null default 'requested'
                  check (status in
                    ('requested', 'confirmed', 'completed', 'cancelled')),
  amount        numeric(10, 2) not null default 0,
  commission    numeric(10, 2) not null default 0,   -- our 18%
  currency      text not null default 'usd',
  stripe_payment_intent_id text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index bookings_user_id_idx on public.bookings (user_id);

-- ---------------------------------------------------------------------------
-- subscriptions — per-pet membership, synced from Stripe
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users (id) on delete cascade,
  pet_id                 uuid references public.pets (id) on delete set null,
  tier                   text not null default 'basic'
                           check (tier in ('basic', 'premium')),
  status                 text not null default 'incomplete'
                           check (status in
                             ('incomplete', 'trialing', 'active', 'past_due',
                              'canceled', 'unpaid')),
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  started_at             timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_pet_id_idx on public.subscriptions (pet_id);

-- ---------------------------------------------------------------------------
-- travel_bookings — pet-friendly travel (flights, rentals, cars, ground)
-- ---------------------------------------------------------------------------
create table public.travel_bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  pet_id        uuid references public.pets (id) on delete set null,
  type          text not null default 'flight'
                  check (type in ('flight', 'rental', 'car', 'ground', 'other')),
  partner_id    uuid references public.vendors (id) on delete set null,
  destination   text,
  details       jsonb not null default '{}'::jsonb,
  amount        numeric(10, 2) not null default 0,
  commission    numeric(10, 2) not null default 0,
  currency      text not null default 'usd',
  status        text not null default 'requested'
                  check (status in
                    ('requested', 'confirmed', 'completed', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index travel_bookings_user_id_idx on public.travel_bookings (user_id);

-- ---------------------------------------------------------------------------
-- ai_conversations — one row per pet, full message history as JSONB
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets (id) on delete cascade,
  messages    jsonb not null default '[]'::jsonb,  -- [{ role, content, ts }]
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (pet_id)
);
create index ai_conversations_pet_id_idx on public.ai_conversations (pet_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger pets_set_updated_at before update on public.pets
  for each row execute function public.set_updated_at();
create trigger health_records_set_updated_at before update on public.health_records
  for each row execute function public.set_updated_at();
create trigger vaccinations_set_updated_at before update on public.vaccinations
  for each row execute function public.set_updated_at();
create trigger vendors_set_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger travel_bookings_set_updated_at before update on public.travel_bookings
  for each row execute function public.set_updated_at();
create trigger ai_conversations_set_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.users            enable row level security;
alter table public.pets             enable row level security;
alter table public.health_records   enable row level security;
alter table public.vaccinations     enable row level security;
alter table public.vendors          enable row level security;
alter table public.services         enable row level security;
alter table public.bookings         enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.travel_bookings  enable row level security;
alter table public.ai_conversations enable row level security;

-- users: see/edit only your own profile row.
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

-- pets: owner-scoped CRUD.
create policy "pets_owner_all" on public.pets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- health_records: scoped through the parent pet's owner.
create policy "health_records_via_pet" on public.health_records
  for all
  using (exists (
    select 1 from public.pets p
    where p.id = health_records.pet_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.pets p
    where p.id = health_records.pet_id and p.owner_id = auth.uid()
  ));

-- vaccinations: scoped through the parent pet's owner.
create policy "vaccinations_via_pet" on public.vaccinations
  for all
  using (exists (
    select 1 from public.pets p
    where p.id = vaccinations.pet_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.pets p
    where p.id = vaccinations.pet_id and p.owner_id = auth.uid()
  ));

-- ai_conversations: scoped through the parent pet's owner.
create policy "ai_conversations_via_pet" on public.ai_conversations
  for all
  using (exists (
    select 1 from public.pets p
    where p.id = ai_conversations.pet_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.pets p
    where p.id = ai_conversations.pet_id and p.owner_id = auth.uid()
  ));

-- bookings: owner-scoped on user_id.
create policy "bookings_owner_all" on public.bookings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- travel_bookings: owner-scoped on user_id.
create policy "travel_bookings_owner_all" on public.travel_bookings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- subscriptions: clients read their own; writes come from the Stripe webhook
-- (service role, which bypasses RLS).
create policy "subscriptions_owner_select" on public.subscriptions
  for select using (auth.uid() = user_id);

-- vendors / services: public catalog. A vendor owner manages their own rows.
create policy "vendors_public_read" on public.vendors
  for select using (true);
create policy "vendors_owner_write" on public.vendors
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "services_public_read" on public.services
  for select using (true);
create policy "services_vendor_owner_write" on public.services
  for all
  using (exists (
    select 1 from public.vendors v
    where v.id = services.vendor_id and v.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.vendors v
    where v.id = services.vendor_id and v.owner_id = auth.uid()
  ));

-- =============================================================================
-- Storage — private bucket for pet documents (records, vaccination certs)
-- Path convention: pet-documents/<auth.uid()>/<pet_id>/<filename>
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('pet-documents', 'pet-documents', false)
on conflict (id) do nothing;

create policy "pet_documents_owner_read" on storage.objects
  for select using (
    bucket_id = 'pet-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "pet_documents_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'pet-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "pet_documents_owner_update" on storage.objects
  for update using (
    bucket_id = 'pet-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "pet_documents_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'pet-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================================================
-- Seed a few public marketplace vendors + services (catalog stub)
-- =============================================================================
insert into public.vendors (id, name, category, description, location, doodle_specialist, rating)
values
  ('11111111-1111-1111-1111-111111111111', 'Curly Coats Grooming', 'grooming',
   'Doodle-specialist groomers — teddy-bear trims and de-matting.', 'Austin, TX', true, 4.9),
  ('22222222-2222-2222-2222-222222222222', 'Pawsitive Training Co.', 'specialist',
   'Force-free obedience and puppy classes for high-energy doodles.', 'Denver, CO', true, 4.8),
  ('33333333-3333-3333-3333-333333333333', 'Doodle Den Sitters', 'sitter',
   'Vetted, cage-free boarding and house-sitting with web-cam check-ins.', 'Seattle, WA', true, 4.7),
  ('44444444-4444-4444-4444-444444444444', 'PupFuel Fresh Food', 'food',
   'Fresh, vet-formulated meals shipped monthly.', 'Remote', false, 4.6)
on conflict (id) do nothing;

insert into public.services (vendor_id, title, description, price, recurring, interval)
values
  ('11111111-1111-1111-1111-111111111111', 'Full Groom', 'Bath, trim, nails, ears.', 85.00, false, 'once'),
  ('11111111-1111-1111-1111-111111111111', 'Monthly Grooming Plan', 'One full groom per month.', 75.00, true, 'month'),
  ('22222222-2222-2222-2222-222222222222', 'Puppy Foundations (6 wk)', 'Group class series.', 199.00, false, 'once'),
  ('33333333-3333-3333-3333-333333333333', 'Overnight Boarding', 'Per night, cage-free.', 65.00, false, 'once'),
  ('44444444-4444-4444-4444-444444444444', 'Fresh Food Subscription', 'Monthly fresh-food delivery.', 120.00, true, 'month')
on conflict do nothing;
