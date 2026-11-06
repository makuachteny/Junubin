-- 00015 — Split sensitive fields off the broadly-readable Profile/User
-- tables so they can't leak via the existing `Anyone authenticated can
-- read profiles` policy in 00002_rls.sql.
--
-- Why a split rather than column-level GRANT REVOKE: PostgREST's
-- `select=*` patterns (AuthContext.fetchUser uses `select('*, profile:
-- Profile(*)...')`) would 403 on a revoked column even when the caller
-- is the owner. Moving sensitive fields to dedicated 1:1 tables with
-- owner-only RLS lets `*` keep working without leaking secrets.
--
-- What moves:
--   * Profile.surveyAnswers (JSONB) → ProfileSurveyAnswers
--     The accessibility-survey responses are personal disability
--     information; they have no business being readable by anyone
--     except the owner and the moderation/admin role.
--   * User.moderationReason (TEXT) → UserModerationDetail
--     Free-text reason a user was restricted/banned. Keeping this
--     readable cross-user lets one user dox another's review status.
--
-- What stays public (intentionally):
--   * Profile.surveyCompletedAt — boolean-ish "is this profile dating-
--     eligible"; the discover deck's filtering already implies this
--     anyway, so leaking it via PostgREST is no new exposure.
--   * Profile.eulaAcceptedAt + eulaVersion — just timestamps; no PII.
--   * User.moderationStatus + moderationExpiresAt — surfaces "is this
--     account active" which the app already needs to know to gate
--     interactions. Treated like an isActive flag.
--   * Post.moderationVerdict — restricted via column-level REVOKE
--     (listPosts already enumerates columns and never selects it).

-- ── 1. ProfileSurveyAnswers ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProfileSurveyAnswers" (
  "userId"  TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "answers" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "ProfileSurveyAnswers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Survey answers — owner read only"
  ON "ProfileSurveyAnswers" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "ProfileSurveyAnswers"."userId"
    )
  );

CREATE POLICY "Survey answers — owner upsert"
  ON "ProfileSurveyAnswers" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "ProfileSurveyAnswers"."userId"
    )
  );

CREATE POLICY "Survey answers — owner update"
  ON "ProfileSurveyAnswers" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "ProfileSurveyAnswers"."userId"
    )
  );

-- Migrate any pre-existing answers off Profile (likely none yet —
-- 00014 only just landed — but we belt-and-brace).
INSERT INTO "ProfileSurveyAnswers" ("userId", "answers")
  SELECT "userId", "surveyAnswers"
    FROM "Profile"
   WHERE "surveyAnswers" IS NOT NULL
  ON CONFLICT ("userId") DO NOTHING;

ALTER TABLE "Profile" DROP COLUMN IF EXISTS "surveyAnswers";

-- ── 2. UserModerationDetail ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserModerationDetail" (
  "userId"   TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "reason"   TEXT,
  "verdict"  JSONB,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "UserModerationDetail" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderation detail — owner read only"
  ON "UserModerationDetail" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "UserModerationDetail"."userId"
    )
  );

-- Inserts/updates are intentionally NOT exposed to authenticated. Only
-- service-role (admin moderation tools) writes here. authenticated
-- never gets to write their own moderation reason.

INSERT INTO "UserModerationDetail" ("userId", "reason")
  SELECT "id", "moderationReason"
    FROM "User"
   WHERE "moderationReason" IS NOT NULL
  ON CONFLICT ("userId") DO NOTHING;

ALTER TABLE "User" DROP COLUMN IF EXISTS "moderationReason";

-- Re-define clear_expired_moderation now that moderationReason has
-- moved to UserModerationDetail. The previous version (00014) wrote
-- `moderationReason = NULL` directly on User, which would fail after
-- the column drop above. Functions are validated lazily in Postgres
-- (parsed but not type-checked at CREATE), so the broken function
-- would only surface on first call — easy to miss in dev.
CREATE OR REPLACE FUNCTION public.clear_expired_moderation()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleared_count INTEGER;
BEGIN
  -- Single CTE chain: unrestrict the User rows, then delete their
  -- corresponding UserModerationDetail rows so the next incident
  -- starts with a clean reason/verdict. We RETURN the count of users
  -- that were actually flipped (UPDATE), not the count of detail rows
  -- deleted (which can be smaller — older incidents may have no
  -- detail row at all).
  WITH cleared AS (
    UPDATE "User"
       SET "moderationStatus" = 'active',
           "moderationExpiresAt" = NULL
     WHERE "moderationStatus" = 'restricted'
       AND "moderationExpiresAt" IS NOT NULL
       AND "moderationExpiresAt" < now()
     RETURNING id
  ),
  detail_cleanup AS (
    DELETE FROM "UserModerationDetail" d
     USING cleared c
     WHERE d."userId" = c.id
     RETURNING d."userId"
  )
  SELECT count(*)::int INTO cleared_count FROM cleared;

  RETURN cleared_count;
END;
$$;

-- ── 3. Post.moderationVerdict — column-level revoke ────────────────
--
-- The verdict JSONB has flagging labels and confidences that aren't
-- meant to be on the Community feed. listPosts already enumerates the
-- columns it selects so the REVOKE is safe; only the moderate-image
-- Edge Function (service-role) and explicit owner queries need it.
REVOKE SELECT ("moderationVerdict") ON "Post" FROM anon, authenticated;

-- Owner can still see their own verdict via this RPC, useful for
-- showing "Your post was held for review because…" in the future.
CREATE OR REPLACE FUNCTION public.get_post_moderation_verdict(p_post_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  result JSONB;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT p."moderationVerdict"
    INTO result
    FROM "Post" p
    JOIN "User" u ON u.id = p."userId"
   WHERE p.id = p_post_id AND u.auth_id = uid;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_moderation_verdict(TEXT) TO authenticated;

-- ── 4. Helper: my own moderation reason ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_moderation_detail()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  out_reason TEXT;
  out_verdict JSONB;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT d.reason, d.verdict
    INTO out_reason, out_verdict
    FROM "UserModerationDetail" d
    JOIN "User" u ON u.id = d."userId"
   WHERE u.auth_id = uid;
  RETURN jsonb_build_object('reason', out_reason, 'verdict', out_verdict);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_moderation_detail() TO authenticated;
