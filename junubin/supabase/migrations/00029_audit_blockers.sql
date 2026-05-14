-- 00029 — TestFlight blocker audit cleanup.
--
-- Bundles four server-side fixes the pre-launch audit flagged as
-- blockers. Each section is independent and idempotent so a partial
-- rollback (e.g. drop one section) doesn't break the others.

-- ============================================================================
-- #1 — Server-side daily like status RPC
-- ============================================================================
-- The client used to compute "tier > free? unlimited : 25/day" locally
-- and treat the result as truth. The actual quota is server-enforced
-- inside the `swipe` Edge Function so a patched client can't actually
-- swipe past 25/day, but the UI badge ("25 likes left today") could be
-- spoofed by flipping a JS bool. Expose a SECURITY DEFINER RPC that
-- returns the authoritative numbers so the UI always reflects the
-- same view the server enforces.
CREATE OR REPLACE FUNCTION public.get_daily_like_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id         TEXT;
  base_tier     TEXT;
  promo_tier    TEXT;
  promo_ends_at TIMESTAMPTZ;
  effective     TEXT;
  rank_free     INT := 0;
  rank_plus     INT := 1;
  rank_junub    INT := 2;
  tier_rank     INT;
  promo_rank    INT;
  used          INT;
  start_today   TIMESTAMPTZ;
  free_limit    CONSTANT INT := 25;
BEGIN
  SELECT id, "subscriptionTier", "promoTier", "promoEndsAt"
    INTO me_id, base_tier, promo_tier, promo_ends_at
    FROM "User"
   WHERE auth_id = auth.uid()
   LIMIT 1;

  IF me_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Effective tier = max(base, active-promo). Mirror of the JS
  -- resolveMode logic but the source of truth.
  effective := COALESCE(base_tier, 'free');
  IF promo_tier IS NOT NULL
     AND promo_ends_at IS NOT NULL
     AND promo_ends_at > NOW()
  THEN
    tier_rank := CASE effective WHEN 'plus' THEN rank_plus WHEN 'junub' THEN rank_junub ELSE rank_free END;
    promo_rank := CASE promo_tier WHEN 'plus' THEN rank_plus WHEN 'junub' THEN rank_junub ELSE rank_free END;
    IF promo_rank > tier_rank THEN
      effective := promo_tier;
    END IF;
  END IF;

  start_today := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT COUNT(*) INTO used
    FROM "Swipe"
   WHERE "fromUserId" = me_id
     AND type IN ('like', 'super_like')
     AND "createdAt" >= start_today;

  IF effective <> 'free' THEN
    RETURN jsonb_build_object(
      'tier', effective,
      'used', used,
      'limit', NULL,
      'remaining', NULL,
      'unlimited', TRUE
    );
  END IF;

  RETURN jsonb_build_object(
    'tier', effective,
    'used', used,
    'limit', free_limit,
    'remaining', GREATEST(0, free_limit - used),
    'unlimited', FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_like_status() TO authenticated;

-- ============================================================================
-- #2 — VerificationRequest table (photo verification audit trail)
-- ============================================================================
-- PhotoVerificationScreen used to flip a local "submitted" state and
-- the user was told they were verified — `User.isVerified` was never
-- written. Apple App Review treats fake verification badges as
-- grounds for rejection. This table is the audit trail: every selfie
-- submission writes a row in 'pending'; an admin (or future moderation
-- pipeline) flips the row to 'approved' or 'rejected', and the trigger
-- below mirrors the result onto `User.isVerified` so the rest of the
-- app's verified-badge UX keeps working unchanged.
CREATE TABLE IF NOT EXISTS "VerificationRequest" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"      TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "photoUrl"    TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending'
        CHECK ("status" IN ('pending', 'approved', 'rejected')),
    "rejectionReason" TEXT,
    "reviewedAt"  TIMESTAMPTZ,
    "reviewedBy"  TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VerificationRequest_userId_idx"
    ON "VerificationRequest" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "VerificationRequest_status_idx"
    ON "VerificationRequest" ("status") WHERE "status" = 'pending';

ALTER TABLE "VerificationRequest" ENABLE ROW LEVEL SECURITY;

-- Owners read their own requests; nobody else can.
DROP POLICY IF EXISTS "Users read own verification" ON "VerificationRequest";
CREATE POLICY "Users read own verification"
    ON "VerificationRequest" FOR SELECT
    USING ("userId" = public.current_user_id());

-- Owners insert their own. status defaults to 'pending'; we don't
-- trust the client to set it.
DROP POLICY IF EXISTS "Users submit own verification" ON "VerificationRequest";
CREATE POLICY "Users submit own verification"
    ON "VerificationRequest" FOR INSERT
    WITH CHECK (
      "userId" = public.current_user_id()
      AND ("status" = 'pending' OR "status" IS NULL)
    );

-- Only service_role can update (i.e. the admin review pipeline).
-- Clients can't approve themselves.

-- Mirror status to User.isVerified on approve, clear on reject.
CREATE OR REPLACE FUNCTION public.sync_user_verified_from_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      UPDATE "User" SET "isVerified" = TRUE WHERE id = NEW."userId";
    ELSIF NEW.status = 'rejected' THEN
      UPDATE "User" SET "isVerified" = FALSE WHERE id = NEW."userId";
    END IF;
    NEW."reviewedAt" := NOW();
    NEW."updatedAt"  := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_verified ON "VerificationRequest";
CREATE TRIGGER trg_sync_user_verified
    BEFORE UPDATE ON "VerificationRequest"
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_verified_from_request();

-- ============================================================================
-- #3 — Tighten User SELECT RLS
-- ============================================================================
-- The 00002 policy let any authenticated user read any User row.
-- That's an enumeration vector for a dating app — a single fake
-- account could scrape the entire member directory via the Supabase
-- anon key. Replace with a "you can see users you're connected to,
-- or rows the server-side discover function hands you" policy.
--
-- The `discover` Edge Function uses the service role and bypasses
-- RLS, so the swipe deck still fills normally. Direct client queries
-- (matchesService, likesService, follow service) get narrower reads:
-- only the people the caller actually has a relationship with.

DROP POLICY IF EXISTS "Users can read active users" ON "User";

CREATE POLICY "Users read connected users"
    ON "User" FOR SELECT
    USING (
        -- Self
        auth_id = auth.uid()
        -- Matches in either direction
        OR EXISTS (
            SELECT 1 FROM "Match" m
            WHERE m.status = 'active'
              AND (
                (m."userAId" = "User"."id" AND m."userBId" = public.current_user_id())
                OR (m."userBId" = "User"."id" AND m."userAId" = public.current_user_id())
              )
        )
        -- People I've swiped on, or who've swiped on me (Likes screen,
        -- whisper recipients, super-like senders all rely on this).
        OR EXISTS (
            SELECT 1 FROM "Swipe" s
            WHERE (s."fromUserId" = public.current_user_id() AND s."toUserId" = "User"."id")
               OR (s."toUserId" = public.current_user_id() AND s."fromUserId" = "User"."id")
        )
        -- Follow graph (FindFriends, FollowList screens). Bi-directional.
        OR EXISTS (
            SELECT 1 FROM "Follow" f
            WHERE (f."followerId" = public.current_user_id() AND f."followingId" = "User"."id")
               OR (f."followingId" = public.current_user_id() AND f."followerId" = "User"."id")
        )
        -- Post authors the caller can already see via the public
        -- Post SELECT policy. Without this branch, the Community feed
        -- shows posts but every author User-join renders blank. The
        -- column is `userId` (00012_posts_safety_unmatch.sql), not
        -- `authorId` — earlier draft tripped a 42703 here. There's
        -- no soft-delete column on Post, so no deletedAt filter.
        OR EXISTS (
            SELECT 1 FROM "Post" p
            WHERE p."userId" = "User"."id"
        )
    );

-- ============================================================================
-- #4 — Validate the under-18 age constraint
-- ============================================================================
-- The 00014 migration added `User_minimum_age_chk` with `NOT VALID`,
-- which only enforces the constraint on NEW rows. Any legacy User
-- row whose dateOfBirth is unset or under 18 still slips through.
-- App Review will flag a single underage profile as cause for
-- rejection on a dating app.
--
-- We don't VALIDATE the constraint directly because that hard-fails
-- the migration if a single bad row exists. Instead: soft-fix any
-- offenders (clear their dateOfBirth, mark the account inactive),
-- THEN validate. Operators get a one-shot view of the affected rows
-- via the raise notice before the cleanup runs.

DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
    FROM "User"
   WHERE "dateOfBirth" IS NOT NULL
     AND "dateOfBirth" > NOW() - INTERVAL '18 years';

  IF bad_count > 0 THEN
    RAISE NOTICE '[00029] Soft-deactivating % under-18 User row(s) before validating constraint.', bad_count;

    UPDATE "User"
       SET "isActive"   = FALSE,
           "moderationStatus" = 'restricted'
     WHERE "dateOfBirth" IS NOT NULL
       AND "dateOfBirth" > NOW() - INTERVAL '18 years';
  END IF;
END $$;

-- Now safe to validate. If any rows still violate (e.g. NULL dob is
-- in scope of the constraint), this errors loudly.
ALTER TABLE "User" VALIDATE CONSTRAINT "User_minimum_age_chk";

-- Reload PostgREST so the new RPC + tightened policy are picked up
-- by the API surface immediately.
NOTIFY pgrst, 'reload schema';
