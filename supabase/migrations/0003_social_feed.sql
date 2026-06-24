-- 0003_social_feed.sql
-- Community feed: members post photos of their dogs, like, and comment.
-- The feed is visible to all signed-in members, but the pets/users tables are
-- owner-scoped by RLS (you can't read another member's pets), so the display
-- fields (author_name, pet_name) are snapshotted onto the post at creation.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  pet_id uuid references public.pets(id) on delete set null,
  pet_name text,
  caption text not null default '',
  image_url text,
  location text,
  hashtags text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy posts_select_auth on public.posts
  for select to authenticated using (true);
create policy posts_insert_own on public.posts
  for insert to authenticated with check (auth.uid() = author_id);
create policy posts_update_own on public.posts
  for update to authenticated using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
create policy posts_delete_own on public.posts
  for delete to authenticated using (auth.uid() = author_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.post_comments enable row level security;
create policy comments_select_auth on public.post_comments
  for select to authenticated using (true);
create policy comments_insert_own on public.post_comments
  for insert to authenticated with check (auth.uid() = author_id);
create policy comments_delete_own on public.post_comments
  for delete to authenticated using (auth.uid() = author_id);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
create policy likes_select_auth on public.post_likes
  for select to authenticated using (true);
create policy likes_insert_own on public.post_likes
  for insert to authenticated with check (auth.uid() = user_id);
create policy likes_delete_own on public.post_likes
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists comments_post_idx on public.post_comments (post_id, created_at);

-- Public bucket for shared dog photos (meant to be seen by the community;
-- sensitive health docs stay in the private pet-documents bucket).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-photos', 'post-photos', true, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- NOTE: no SELECT policy on purpose. Public buckets serve object URLs via the
-- public CDN endpoint without one; adding a broad SELECT policy would let
-- clients enumerate every file in the bucket. Owners still read their own via
-- the public URL we store on each post.
create policy post_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);
