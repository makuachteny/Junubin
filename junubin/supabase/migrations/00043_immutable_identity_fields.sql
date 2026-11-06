-- 00043 — Immutable identity fields (anti-cheat).
--
-- Date of birth and name must not be freely editable after they're set,
-- otherwise a user can fake their age (an age-fraud / minor-safety risk)
-- or impersonate someone by swapping names. This mirrors how the major
-- dating apps behave:
--   * Tinder  — date of birth is locked in-app after signup.
--   * Hinge   — allows a single birthday change, then locks it.
--   * Bumble  — ties DOB to ID verification; it can't be changed after.
-- Name is likewise fixed / verification-bound across these apps.
--
-- The client (EditProfile) presents name and a set DOB as read-only, but
-- client locks are bypassable — anyone can hit PostgREST directly — so
-- the real guarantee lives here as a BEFORE UPDATE trigger on "User".
--
-- Rules:
--   * displayName — immutable once it holds a non-empty value. The
--     handle_new_user trigger (00003) seeds it to '' on signup and
--     ProfileSetup writes the real name once; after that it's frozen.
--     The empty-string seed is treated as "not yet set" so onboarding's
--     first write is allowed.
--   * dateOfBirth — immutable once non-null (first set during
--     ProfileSetup or a one-time set in EditProfile; frozen thereafter).
--   * service_role bypasses the lock so support / moderation tooling can
--     still correct a genuine mistake.
--   * No-op writes (NEW = OLD) always pass — the app's profile save
--     re-sends unchanged columns and must not error on them.

CREATE OR REPLACE FUNCTION public.enforce_immutable_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  -- Trusted server-side callers (service-role key) may correct values.
  -- request.jwt.claims is set by PostgREST per request; unset for
  -- internal DB processes, which then fall through to enforcement.
  jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD."displayName" IS NOT NULL
     AND OLD."displayName" <> ''
     AND NEW."displayName" IS DISTINCT FROM OLD."displayName" THEN
    RAISE EXCEPTION 'displayName is immutable once set'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."dateOfBirth" IS NOT NULL
     AND NEW."dateOfBirth" IS DISTINCT FROM OLD."dateOfBirth" THEN
    RAISE EXCEPTION 'dateOfBirth is immutable once set'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_immutable_identity ON "User";
CREATE TRIGGER trg_enforce_immutable_identity
  BEFORE UPDATE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutable_identity();

NOTIFY pgrst, 'reload schema';
