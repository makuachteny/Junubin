-- Tighten storage SELECT policies: anyone (anon or authed) could previously
-- query storage.objects and enumerate every uploaded file path for the
-- photos / posts / stories buckets. Public CDN URLs (getPublicUrl) continue
-- to work — they bypass RLS — so feed/profile/story rendering is unaffected.
-- This only blocks anonymous use of the storage API for listing/lookup.
--
-- Three names existed for "anyone can SELECT photos" across migrations
-- (00002 "Public read access for photos", 00011 "Photos public read") plus
-- the parallel "Posts img public read" (00012) and "Stories img public read"
-- (00017). Drop them all, then recreate each gated on auth.uid().

DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;
DROP POLICY IF EXISTS "Photos public read"            ON storage.objects;
DROP POLICY IF EXISTS "Posts img public read"         ON storage.objects;
DROP POLICY IF EXISTS "Stories img public read"       ON storage.objects;

CREATE POLICY "Photos read (auth only)"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos'  AND auth.uid() IS NOT NULL);

CREATE POLICY "Posts read (auth only)"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts'   AND auth.uid() IS NOT NULL);

CREATE POLICY "Stories read (auth only)"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stories' AND auth.uid() IS NOT NULL);
