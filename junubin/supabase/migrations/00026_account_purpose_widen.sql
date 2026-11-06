-- 00026 — Widen the Profile.accountPurpose CHECK constraint.
--
-- The original 00010 migration restricted accountPurpose to
-- ('date', 'socialize'). The client, however, has always written
-- 'dating' (ProfileSetupScreen → PURPOSE_OPTIONS), the eligibility
-- helper has always *read* 'dating' and 'both', and the swipe edge
-- function gates on the same set. Result: every profile-setup save
-- that wrote `accountPurpose: 'dating'` was rejected by the CHECK
-- constraint, and the surveyCompletedAt / dating-action gate then
-- behaved as if the user hadn't completed the purpose step — sending
-- them back through the survey nudge in a loop.
--
-- Fix: drop the old constraint and re-add with the canonical
-- vocabulary the rest of the codebase already uses. Backfills any
-- legacy 'date' rows to 'dating' so reads round-trip cleanly.
--
-- Canonical values going forward:
--   'dating'    — primarily here to date
--   'socialize' — primarily here to make friends
--   'both'      — open to either
--
-- Legacy 'date' is accepted by the constraint so historic rows
-- don't fail validation, but the backfill below ensures no row
-- remains in that state after this migration runs.

-- Normalize legacy rows first so they pass the new constraint.
UPDATE "Profile"
SET "accountPurpose" = 'dating'
WHERE "accountPurpose" = 'date';

-- Drop the old constraint. Its name was auto-generated as
-- "Profile_accountPurpose_check" but we use a defensive lookup so
-- this works whether the platform named it differently.
DO $$
DECLARE
    cname text;
BEGIN
    SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'public."Profile"'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%accountPurpose%';
    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public."Profile" DROP CONSTRAINT %I', cname);
    END IF;
END $$;

-- Re-add with the expanded set the rest of the app uses. 'date' is
-- kept on the accept-list so a manual SQL insert from an older runbook
-- doesn't fail; the application code will never write it.
ALTER TABLE "Profile"
ADD CONSTRAINT "Profile_accountPurpose_check"
CHECK (
    "accountPurpose" IS NULL
    OR "accountPurpose" IN ('dating', 'socialize', 'both', 'date')
);

COMMENT ON COLUMN "Profile"."accountPurpose" IS
    'User-stated reason for being on the app. Canonical values: ''dating'' | ''socialize'' | ''both''. ''date'' is accepted for backward compat with rows written under the 00010 constraint.';
