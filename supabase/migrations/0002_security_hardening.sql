-- 0002_security_hardening.sql
-- Tightens up the health-records vault after a security review. Pet medical
-- records aren't covered by HIPAA (HIPAA is human PHI), but owners' data and
-- their pets' medical history are sensitive, so we apply the same posture:
-- least privilege, private storage, owner-scoped access everywhere.
--
-- Baseline already in place (see 0001_init.sql):
--   * RLS enabled and owner-scoped on every public table.
--   * `pet-documents` storage bucket is PRIVATE (public = false) with
--     owner-scoped policies for select/insert/update/delete; files are only
--     ever served through short-lived signed URLs.

-- 1) Pin search_path so the trigger helper can't be hijacked via a mutable path.
alter function public.set_updated_at() set search_path = '';

-- 2) These run only as triggers / event triggers. They should never be callable
--    as PostgREST RPCs by anonymous or signed-in users. Triggers still fire
--    normally after the grants are revoked.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 3) Defense in depth on the documents bucket: cap upload size and allow only
--    the medical document/image types we accept. RLS still gates every object.
update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array[
      'image/png','image/jpeg','image/webp','image/gif','application/pdf'
    ]
where id = 'pet-documents';

-- NOTE (manual, dashboard-only): enable "Leaked password protection"
-- (Authentication → Providers → Email → Password security) so Supabase Auth
-- checks new passwords against HaveIBeenPwned. Can't be toggled from SQL.
