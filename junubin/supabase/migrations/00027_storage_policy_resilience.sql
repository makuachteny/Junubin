-- 00027 — Make the photos-bucket upload policy resilient to PostgREST
-- schema-cache hiccups, and force PostgREST to reload the cache after
-- this migration runs.
--
-- Symptom we're fixing: when a user finished ProfileSetup and the app
-- called supabase.storage.from('photos').upload(...), the request
-- failed with HTTP 503 + message "The database schema is invalid or
-- incompatible." That message is PGRST telling us its in-memory view
-- of the schema doesn't match the database — usually because earlier
-- migrations (00026 widening Profile.accountPurpose, 00025 adding
-- mode columns) altered tables that the storage INSERT policy
-- references, and PGRST hadn't picked the changes up yet.
--
-- The original 00002 policy ran a correlated subquery against
-- public."User" inside the WITH CHECK clause:
--
--   WITH CHECK (
--     bucket_id = 'photos'
--     AND auth.uid() IS NOT NULL
--     AND (storage.foldername(name))[1] =
--         (SELECT id FROM public."User" WHERE auth_id = auth.uid() LIMIT 1)
--   );
--
-- The subquery makes RLS planner reach into another schema on every
-- INSERT — when PGRST's cache stale-routes the table, the whole
-- evaluation throws. Wrap the lookup in a STABLE security-definer
-- function so the planner sees a stable callable and we get a clean
-- 403 (or success) instead of a 503/schema error.

-- Stable lookup helper. SECURITY DEFINER so it can read public."User"
-- even when the caller is anon/authenticated under tighter RLS.
CREATE OR REPLACE FUNCTION public.app_user_id_for_storage()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT id FROM public."User" WHERE auth_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.app_user_id_for_storage() TO anon, authenticated, service_role;

-- Drop and re-add the upload + delete policies using the helper.
DROP POLICY IF EXISTS "Authenticated users can upload own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload own photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'photos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.app_user_id_for_storage()
    );

CREATE POLICY "Users can delete own photos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'photos'
        AND (storage.foldername(name))[1] = public.app_user_id_for_storage()
    );

-- Also re-issue the UPDATE policy so a re-uploaded object can replace
-- itself (rare path, but the previous migrations didn't include one
-- which caused PUT-style overwrites to fail silently).
DROP POLICY IF EXISTS "Users can update own photos in storage" ON storage.objects;
CREATE POLICY "Users can update own photos in storage"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'photos'
        AND (storage.foldername(name))[1] = public.app_user_id_for_storage()
    )
    WITH CHECK (
        bucket_id = 'photos'
        AND (storage.foldername(name))[1] = public.app_user_id_for_storage()
    );

-- Force PostgREST to drop its schema cache and rebuild on next request.
-- Without this, the client can still see the 503 for up to ~10 minutes
-- after the alterations land, because the storage edge proxy holds the
-- stale plan until something invalidates it.
NOTIFY pgrst, 'reload schema';
