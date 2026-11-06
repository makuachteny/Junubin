-- 00041 — Voice prompts on profile.
--
-- Adds:
--   * Profile.voicePromptUrl       — public URL to the audio file
--   * Profile.voicePromptDurationSec — int seconds (0-30 cap)
--   * Profile.voicePromptQuestion  — the prompt the user picked
--   * voice-prompts storage bucket — public-read, owner-write
--
-- Cap at 30s on the client AND in the upload guard. The 30s limit is
-- the sweet spot Hinge research surfaces — long enough to convey
-- accent / energy / sense of humour, short enough that the player
-- doesn't become a barrier.
--
-- Idempotent — every block uses IF NOT EXISTS / DROP IF EXISTS / ON
-- CONFLICT.

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "voicePromptUrl"          TEXT,
  ADD COLUMN IF NOT EXISTS "voicePromptDurationSec"  INT,
  ADD COLUMN IF NOT EXISTS "voicePromptQuestion"     TEXT,
  ADD COLUMN IF NOT EXISTS "voicePromptUpdatedAt"    TIMESTAMPTZ;

-- Length sanity check — anything over 35s is rejected at the column
-- level so a malformed client can't bypass the 30s app-level cap.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'voice_prompt_duration_ceiling'
  ) THEN
    ALTER TABLE "Profile"
      ADD CONSTRAINT voice_prompt_duration_ceiling
      CHECK ("voicePromptDurationSec" IS NULL OR ("voicePromptDurationSec" > 0 AND "voicePromptDurationSec" <= 35));
  END IF;
END $$;

-- ── Storage bucket ──────────────────────────────────────────────────
-- `voice-prompts` mirrors the `photos` bucket layout: public-read so
-- the audio player works without signed URLs (lower latency on the
-- profile card), owner-write enforced by RLS via first-path-segment
-- matching User.id (same convention as photos / stories).
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-prompts', 'voice-prompts', true)
ON CONFLICT (id) DO NOTHING;

-- Path-prefix INSERT policy — file path MUST start with the caller's
-- User.id. Without this any authenticated user could overwrite anyone
-- else's prompt by uploading to <victim>/whatever.m4a.
DROP POLICY IF EXISTS "voice prompts owner insert" ON storage.objects;
CREATE POLICY "voice prompts owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-prompts'
    AND (storage.foldername(name))[1] = public.current_user_id()
  );

DROP POLICY IF EXISTS "voice prompts owner update" ON storage.objects;
CREATE POLICY "voice prompts owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'voice-prompts'
    AND (storage.foldername(name))[1] = public.current_user_id()
  )
  WITH CHECK (
    bucket_id = 'voice-prompts'
    AND (storage.foldername(name))[1] = public.current_user_id()
  );

DROP POLICY IF EXISTS "voice prompts owner delete" ON storage.objects;
CREATE POLICY "voice prompts owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-prompts'
    AND (storage.foldername(name))[1] = public.current_user_id()
  );

-- Public read — Profile.voicePromptUrl is rendered on every card,
-- mirroring how photos work. Anonymous-listing is still blocked by
-- the 00024 policy that applies bucket-wide; only direct URL fetches
-- of known paths land.
DROP POLICY IF EXISTS "voice prompts public read" ON storage.objects;
CREATE POLICY "voice prompts public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-prompts');

NOTIFY pgrst, 'reload schema';
