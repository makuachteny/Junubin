-- 00020 — Server-side monthly spotlight grant for Junub-tier users.
-- Replaces the client-only AsyncStorage tracking which was bypassable by
-- reinstalling the app within the same calendar month.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastMonthlySpotlightAt" TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_monthly_spotlight()
RETURNS TABLE("granted" BOOLEAN, "spotlights" INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id           TEXT;
  me_tier         TEXT;
  me_promo_tier   TEXT;
  me_promo_ends   TIMESTAMPTZ;
  last_grant      TIMESTAMPTZ;
  current_month   TEXT;
  last_month      TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id, "subscriptionTier", "promoTier", "promoEndsAt", "lastMonthlySpotlightAt"
    INTO me_id, me_tier, me_promo_tier, me_promo_ends, last_grant
    FROM "User"
    WHERE auth_id = auth.uid();
  IF me_id IS NULL THEN
    RAISE EXCEPTION 'no user row';
  END IF;

  -- Eligible if the user is a paid Junub subscriber, OR holds an
  -- active promo grant for the Junub tier (promoEndsAt still in the
  -- future). Promo-tier users were unintentionally excluded from the
  -- monthly spotlight grant in the original 00020 cut.
  IF NOT (me_tier = 'junub' OR (me_promo_tier = 'junub' AND me_promo_ends > NOW())) THEN
    RETURN QUERY SELECT FALSE, COALESCE("spotlights", 0)
                  FROM "User" WHERE id = me_id;
    RETURN;
  END IF;

  current_month := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');
  last_month    := COALESCE(to_char(last_grant AT TIME ZONE 'UTC', 'YYYY-MM'), '');

  IF last_month = current_month THEN
    RETURN QUERY SELECT FALSE, COALESCE("spotlights", 0)
                  FROM "User" WHERE id = me_id;
    RETURN;
  END IF;

  UPDATE "User"
     SET "spotlights" = COALESCE("spotlights", 0) + 1,
         "lastMonthlySpotlightAt" = NOW()
   WHERE id = me_id;

  RETURN QUERY SELECT TRUE, COALESCE("spotlights", 0)
                FROM "User" WHERE id = me_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_monthly_spotlight() TO authenticated;
