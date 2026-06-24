-- 0007_audience_targeting.sql
-- Audience attributes that power FIRST-PARTY ad targeting (we hold the data;
-- vendors pay to reach a segment and PackHub serves the ad — individual records
-- are never exposed to or sold to vendors).
alter table public.pets
  add column if not exists neutered boolean,                       -- null = unknown
  add column if not exists interests text[] not null default '{}'; -- favorite toys/treats/activities

-- Vendor posts can target a life stage in addition to breed.
alter table public.posts
  add column if not exists target_life_stage text
    check (target_life_stage in ('puppy','adolescent','adult','senior'));
