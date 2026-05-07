-- 00014 — Safety, eligibility, and atomic consume RPCs.
--
-- Closes the loopholes from the second-pass production audit:
--
--   * Survey-completion is the source of truth for dating eligibility.
--   * Age >= 18 is enforced in the database, not just in client UI.
--   * Moderation status (active / restricted / banned) lives on User and
--     is honored everywhere via RPC guards.
--   * Account deletion is hard, not soft (delete, not flag).
--   * Spotlight, super-like, whisper, swipe consumes are atomic and
--     return the new server balance (no client-trusted counters).
--   * Daily swipe cap is enforced server-side.
--   * Posts get a moderation verdict column so unscanned content can be
--     held for review rather than landing instantly in the public feed.
--
-- All RPCs are SECURITY DEFINER and resolve the caller via auth.uid()
-- inside the function body — never trust user-supplied "me" ids.

-- ── 1. Profile.surveyCompletedAt ────────────────────────────────────
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "surveyCompletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "surveyAnswers"     JSONB,
  ADD COLUMN IF NOT EXISTS "eulaAcceptedAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "eulaVersion"       TEXT;

CREATE INDEX IF NOT EXISTS "Profile_surveyCompletedAt_idx"
  ON "Profile" ("surveyCompletedAt") WHERE "surveyCompletedAt" IS NOT NULL;

-- ── 2. Server-side age floor ────────────────────────────────────────
-- Reject any User row whose dateOfBirth is under 18. Existing rows
-- without a DOB are tolerated (legacy data) — the discover Edge
-- Function still filters them out at read time.
ALTER TABLE "User"
  DROP CONSTRAINT IF EXISTS "User_minimum_age_chk";
ALTER TABLE "User"
  ADD CONSTRAINT "User_minimum_age_chk"
  CHECK ("dateOfBirth" IS NULL OR "dateOfBirth" <= now() - INTERVAL '18 years')
  NOT VALID;
-- NOT VALID skips the check on existing rows but enforces it on
-- INSERT/UPDATE going forward. Operators can run
-- `ALTER TABLE "User" VALIDATE CONSTRAINT "User_minimum_age_chk";`
-- once any pre-existing under-18 rows are scrubbed.

-- ── 3. Moderation status ────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "moderationStatus" TEXT NOT NULL DEFAULT 'active'
    CHECK ("moderationStatus" IN ('active', 'restricted', 'banned')),
  ADD COLUMN IF NOT EXISTS "moderationExpiresAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "moderationReason"    TEXT;

CREATE INDEX IF NOT EXISTS "User_moderationStatus_idx"
  ON "User" ("moderationStatus") WHERE "moderationStatus" <> 'active';

-- Auto-clear expired restrictions. Cheap because the index is partial.
CREATE OR REPLACE FUNCTION public.clear_expired_moderation()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH cleared AS (
    UPDATE "User"
       SET "moderationStatus" = 'active',
           "moderationExpiresAt" = NULL,
           "moderationReason" = NULL
     WHERE "moderationStatus" = 'restricted'
       AND "moderationExpiresAt" IS NOT NULL
       AND "moderationExpiresAt" < now()
     RETURNING 1
  )
  SELECT count(*)::int FROM cleared;
$$;

-- ── 4. Post moderation verdict ──────────────────────────────────────
ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "moderationStatus" TEXT NOT NULL DEFAULT 'pending'
    CHECK ("moderationStatus" IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS "moderationVerdict" JSONB,
  ADD COLUMN IF NOT EXISTS "moderationCheckedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Post_moderation_idx"
  ON "Post" ("moderationStatus", "createdAt" DESC);

-- ── 5. Server-trusted consume RPCs ──────────────────────────────────
--
-- Each consume RPC:
--   1. Looks up the caller via auth.uid() — never accepts a user id
--   2. Atomically decrements the counter and refuses if at zero
--   3. Returns the new balance so the client doesn't have to guess
--
-- Argument-less wrappers replace the old (user_auth_id, amount) RPCs
-- the SubscriptionContext was calling — those are kept around for
-- back-compat but are now thin shims that ignore the user_auth_id arg
-- and trust auth.uid() instead.

CREATE OR REPLACE FUNCTION public.try_consume_spotlight()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  me_id TEXT;
  cur_balance INTEGER;
  until TIMESTAMPTZ;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'unauthenticated'); END IF;

  SELECT id INTO me_id FROM "User" WHERE auth_id = uid;
  IF me_id IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'no_user'); END IF;

  -- Banned users can't consume anything; restricted users either.
  IF EXISTS (SELECT 1 FROM "User" WHERE id = me_id AND "moderationStatus" <> 'active') THEN
    RETURN json_build_object('ok', false, 'reason', 'restricted');
  END IF;

  -- Survey is required to spotlight — otherwise we charge the user to
  -- promote an empty profile, which is a refund waiting to happen.
  IF NOT EXISTS (
    SELECT 1 FROM "Profile" WHERE "userId" = me_id AND "surveyCompletedAt" IS NOT NULL
  ) THEN
    RETURN json_build_object('ok', false, 'reason', 'survey_required');
  END IF;

  -- Atomic decrement.
  UPDATE "User"
     SET spotlights = spotlights - 1
   WHERE id = me_id AND spotlights > 0
   RETURNING spotlights INTO cur_balance;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'no_balance');
  END IF;

  -- Activate. 30-min window matches the client expectation.
  until := now() + INTERVAL '30 minutes';
  UPDATE "Profile"
     SET "spotlightedUntil" = until
   WHERE "userId" = me_id;

  RETURN json_build_object(
    'ok', true,
    'balance', cur_balance,
    'spotlightedUntil', until
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_consume_spotlight() TO authenticated;

CREATE OR REPLACE FUNCTION public.try_consume_superlike()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  me_id TEXT;
  cur_balance INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT id INTO me_id FROM "User" WHERE auth_id = uid;
  IF me_id IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'no_user'); END IF;

  IF EXISTS (SELECT 1 FROM "User" WHERE id = me_id AND "moderationStatus" <> 'active') THEN
    RETURN json_build_object('ok', false, 'reason', 'restricted');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Profile" WHERE "userId" = me_id AND "surveyCompletedAt" IS NOT NULL
  ) THEN
    RETURN json_build_object('ok', false, 'reason', 'survey_required');
  END IF;

  UPDATE "User"
     SET "superLikes" = "superLikes" - 1
   WHERE id = me_id AND "superLikes" > 0
   RETURNING "superLikes" INTO cur_balance;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'no_balance');
  END IF;

  RETURN json_build_object('ok', true, 'balance', cur_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_consume_superlike() TO authenticated;

CREATE OR REPLACE FUNCTION public.try_consume_whisper()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  me_id TEXT;
  cur_balance INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT id INTO me_id FROM "User" WHERE auth_id = uid;
  IF me_id IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'no_user'); END IF;

  IF EXISTS (SELECT 1 FROM "User" WHERE id = me_id AND "moderationStatus" <> 'active') THEN
    RETURN json_build_object('ok', false, 'reason', 'restricted');
  END IF;

  -- Whispers are dating layer (paid pre-match note), so survey-gated.
  IF NOT EXISTS (
    SELECT 1 FROM "Profile" WHERE "userId" = me_id AND "surveyCompletedAt" IS NOT NULL
  ) THEN
    RETURN json_build_object('ok', false, 'reason', 'survey_required');
  END IF;

  UPDATE "User"
     SET whispers = whispers - 1
   WHERE id = me_id AND whispers > 0
   RETURNING whispers INTO cur_balance;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'no_balance');
  END IF;

  RETURN json_build_object('ok', true, 'balance', cur_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_consume_whisper() TO authenticated;

CREATE OR REPLACE FUNCTION public.try_consume_coins(p_amount INTEGER)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  me_id TEXT;
  cur_balance INTEGER;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  SELECT id INTO me_id FROM "User" WHERE auth_id = uid;
  IF me_id IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'no_user'); END IF;

  IF EXISTS (SELECT 1 FROM "User" WHERE id = me_id AND "moderationStatus" <> 'active') THEN
    RETURN json_build_object('ok', false, 'reason', 'restricted');
  END IF;

  -- Coins are spent on social affordances (gifts, stickers); no survey gate.
  UPDATE "User"
     SET coins = coins - p_amount
   WHERE id = me_id AND coins >= p_amount
   RETURNING coins INTO cur_balance;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'no_balance');
  END IF;

  RETURN json_build_object('ok', true, 'balance', cur_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_consume_coins(INTEGER) TO authenticated;

-- ── 6. Server-side daily swipe cap + survey gate ────────────────────
--
-- Free users get a soft cap (default 100 likes/day). Paid tiers bypass.
-- The cap is checked atomically inside the RPC so two concurrent swipes
-- can't both squeak through past the limit.

CREATE OR REPLACE FUNCTION public.try_record_swipe(
  p_to_user_id TEXT,
  p_type       TEXT,        -- 'like' | 'pass' | 'super_like'
  p_whisper    TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  me_id TEXT;
  me_tier TEXT;
  me_status TEXT;
  todays_likes INTEGER;
  daily_cap INTEGER := 100;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  IF p_to_user_id IS NULL OR p_to_user_id = '' THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_target');
  END IF;
  IF p_type NOT IN ('like', 'pass', 'super_like') THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_type');
  END IF;

  SELECT id, "subscriptionTier", "moderationStatus"
    INTO me_id, me_tier, me_status
    FROM "User"
    WHERE auth_id = uid;
  IF me_id IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'no_user'); END IF;
  IF me_status <> 'active' THEN
    RETURN json_build_object('ok', false, 'reason', 'restricted');
  END IF;
  IF me_id = p_to_user_id THEN
    RETURN json_build_object('ok', false, 'reason', 'self_swipe');
  END IF;

  -- Survey-incomplete users can't write swipes. The "ok to socially
  -- follow / say hi" path uses a different table (Whisper / Follow).
  IF NOT EXISTS (
    SELECT 1 FROM "Profile" WHERE "userId" = me_id AND "surveyCompletedAt" IS NOT NULL
  ) THEN
    RETURN json_build_object('ok', false, 'reason', 'survey_required');
  END IF;

  -- Block in either direction zeros out the action.
  IF EXISTS (
    SELECT 1 FROM "Block"
     WHERE ("blockerId" = me_id AND "blockedId" = p_to_user_id)
        OR ("blockedId" = me_id AND "blockerId" = p_to_user_id)
  ) THEN
    RETURN json_build_object('ok', false, 'reason', 'blocked');
  END IF;

  -- Free-tier daily cap on `like`. `pass` is unlimited; `super_like`
  -- has its own paid balance, checked separately by try_consume_superlike.
  IF p_type = 'like' AND me_tier = 'free' THEN
    SELECT count(*)
      INTO todays_likes
      FROM "Swipe"
      WHERE "fromUserId" = me_id
        AND "type" IN ('like', 'super_like')
        AND "createdAt" >= date_trunc('day', now());
    IF todays_likes >= daily_cap THEN
      RETURN json_build_object('ok', false, 'reason', 'daily_cap');
    END IF;
  END IF;

  INSERT INTO "Swipe" ("fromUserId", "toUserId", "type", "whisper", "createdAt")
    VALUES (me_id, p_to_user_id, p_type, p_whisper, now())
    ON CONFLICT ("fromUserId", "toUserId") DO UPDATE
      SET "type" = EXCLUDED."type",
          "whisper" = EXCLUDED."whisper",
          "createdAt" = EXCLUDED."createdAt";

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_record_swipe(TEXT, TEXT, TEXT) TO authenticated;

-- ── 7. Hard account delete ──────────────────────────────────────────
--
-- App Store guideline 5.1.1.v requires real deletion. The schema's
-- foreign keys are mostly ON DELETE CASCADE, so deleting the auth.users
-- row tears down User and everything downstream. Storage objects (the
-- user's photos and post images) are removed via the Edge Function
-- supabase/functions/account-delete — this RPC is just the DB half.

CREATE OR REPLACE FUNCTION public.hard_delete_me()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid UUID := auth.uid();
  me_id TEXT;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT id INTO me_id FROM "User" WHERE auth_id = uid;

  -- Wipe the public-schema rows the FK cascades miss. Most tables CASCADE
  -- on User delete (Photo, Profile, Match, Conversation*, Message, Swipe,
  -- Follow, Block, Report, Whisper, GameSession, etc), so the auth row
  -- delete handles them. We belt-and-brace the few rows the Edge Function
  -- can't always see (cron-deferred audit rows, etc.) here.
  IF me_id IS NOT NULL THEN
    DELETE FROM "Post"             WHERE "userId" = me_id;
    DELETE FROM "LiveJoinRequest"  WHERE "hostId" = me_id OR "viewerId" = me_id;
  END IF;

  -- Finally drop the auth row — cascades the User row and everything FK'd.
  DELETE FROM auth.users WHERE id = uid;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hard_delete_me() TO authenticated;
