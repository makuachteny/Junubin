-- ════════════════════════════════════════════════════════════════
-- 00010 — Account purpose + Swipe whispers
-- Two columns the app already reads/writes but the schema missed:
--   1. Profile.accountPurpose ('date' | 'socialize') — drives Dating
--      vs Social mode in `useCurrentUser` and `discover` edge function.
--   2. Swipe.whisper (text) — short message attached to a right-swipe
--      so the recipient sees it on their Likes inbox. Wired through
--      `recordSwipe(toUserId, type, { whisper })` from the client.
-- ════════════════════════════════════════════════════════════════

-- Profile.accountPurpose ------------------------------------------------
ALTER TABLE public."Profile"
  ADD COLUMN IF NOT EXISTS "accountPurpose" text
    CHECK ("accountPurpose" IS NULL OR "accountPurpose" IN ('date', 'socialize'));

COMMENT ON COLUMN public."Profile"."accountPurpose" IS
  'date | socialize — set during ProfileSetup; controls whether HomeScreen shows the dating deck or the social feed.';

-- Swipe.whisper ---------------------------------------------------------
ALTER TABLE public."Swipe"
  ADD COLUMN IF NOT EXISTS "whisper" text;

COMMENT ON COLUMN public."Swipe"."whisper" IS
  'Optional short message included with a right-swipe. Surfaced on the recipient''s Likes screen when they have a paid tier that lets them see who liked them.';

-- Length cap so a malicious / accidental long whisper can''t bloat
-- the Swipe row. 280 mirrors the chat composer copy limits.
ALTER TABLE public."Swipe"
  ADD CONSTRAINT "Swipe_whisper_length_chk"
  CHECK ("whisper" IS NULL OR length("whisper") <= 280);
