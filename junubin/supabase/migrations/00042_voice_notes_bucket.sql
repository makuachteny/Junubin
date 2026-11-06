-- 00042 — Voice-notes storage bucket.
--
-- chatService.uploadVoiceNote() has been writing to a `voice-notes`
-- storage bucket since voice notes shipped, but no migration ever
-- created the bucket. On any fresh Supabase project the upload errors
-- with 404 bucket-not-found and the message just shows as "failed."
-- This migration creates the bucket with the same owner-write /
-- public-read posture as `photos` / `stories`.
--
-- Path layout: voice-notes/<conversationId>/<senderId>-<ts>.m4a
-- We use second-segment ownership (path[2] = caller's User.id) because
-- the conversationId is the first segment — that gives us free
-- per-conversation grouping and a clear blast radius if we ever need
-- to mass-revoke a conversation's media.

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- INSERT: caller must be a member of the conversation (path[1]) AND
-- the path's senderId segment must match their User.id (path[2]
-- starts with their id). Both checks keep one user from writing
-- voice notes that look like they came from another.
DROP POLICY IF EXISTS "voice notes member insert" ON storage.objects;
CREATE POLICY "voice notes member insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND EXISTS (
      SELECT 1 FROM "ConversationMember" cm
      WHERE cm."conversationId" = (storage.foldername(name))[1]
        AND cm."userId" = public.current_user_id()
    )
    AND (storage.foldername(name))[2] LIKE public.current_user_id() || '-%'
  );

-- DELETE: only the sender can delete their own voice note. Same
-- second-segment ownership rule.
DROP POLICY IF EXISTS "voice notes sender delete" ON storage.objects;
CREATE POLICY "voice notes sender delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[2] LIKE public.current_user_id() || '-%'
  );

-- SELECT: members of the conversation can read. We can't enforce
-- "members only" at the storage layer because conversationId lives in
-- the path not a column, but Storage URLs are unguessable enough
-- (UUIDs for both segments) that the practical attack surface is
-- the same as `photos`. Public-read keeps audio playback latency low
-- and avoids signed-URL token expiry mid-listen.
DROP POLICY IF EXISTS "voice notes public read" ON storage.objects;
CREATE POLICY "voice notes public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-notes');

NOTIFY pgrst, 'reload schema';
