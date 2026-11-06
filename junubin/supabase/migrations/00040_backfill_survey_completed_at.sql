-- 00040 — Backfill Profile.surveyCompletedAt for users who finished
-- onboarding but were caught by the May 2026 client bug.
--
-- Background: src/api/services/profileService.updateProfile() shipped
-- with a PROFILE_KEYS allowlist that omitted `surveyCompletedAt`.
-- ProfileSetupScreen *sent* the timestamp on every successful
-- completion, but the service silently dropped it before the UPDATE
-- left the device. Result: every "complete" user had
-- profileComplete=true / accountPurpose set / promptAnswer filled
-- BUT surveyCompletedAt IS NULL — so the eligibility gate kept
-- re-nudging them on every dating action.
--
-- Client fix shipped in the same audit (add the key to the allowlist).
-- This migration repairs the existing-user state so they don't have
-- to re-walk the survey just to make the popup go away.
--
-- We use the user's most-recent profile-related touch as the
-- backfill timestamp — `Profile.updatedAt` if present, otherwise
-- `User.updatedAt`, otherwise now(). The exact value isn't important
-- (the eligibility check only tests for non-null), but we want a
-- sensible audit timestamp rather than a uniform now() that would
-- claim every old user "completed the survey today."

UPDATE "Profile" p
SET "surveyCompletedAt" = COALESCE(
  p."updatedAt",
  (SELECT u."updatedAt" FROM "User" u WHERE u.id = p."userId"),
  NOW()
)
WHERE p."surveyCompletedAt" IS NULL
  AND p."profileComplete" = TRUE
  AND p."accountPurpose" IS NOT NULL
  -- The eligibility gate also requires a prompt answer of at least
  -- 10 chars. If they haven't filled that, they genuinely aren't
  -- done — leave NULL so the nudge correctly routes them to the
  -- prompts step (which is the legitimate "more to do" case).
  AND COALESCE(length(trim(p."promptAnswer")), 0) >= 10;

NOTIFY pgrst, 'reload schema';
