-- 00037 — Per-tier daily swipe limits.
--
-- The 00029 RPC encoded "free = 25, anything paid = unlimited" inline.
-- Product moved to a tiered ceiling: free = 20, plus = 50, junub
-- unlimited. Replace the function so the UI badge (which reads this
-- RPC's `limit`/`remaining`) matches the per-tier gate the swipe Edge
-- Function now enforces. The constants here MUST stay in lock-step
-- with DAILY_LIKE_LIMIT_BY_TIER in supabase/functions/swipe/index.ts
-- and getDailyLikeLimit() in src/payments/entitlements.js — drift
-- shows up as a UI lie or a surprise 429.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + NOTIFY pgrst at the bottom.
-- No data migration needed; the function is computed from live tables.

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
  tier_limit    INT;       -- NULL == uncapped
  free_limit    CONSTANT INT := 20;
  plus_limit    CONSTANT INT := 50;
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

  -- Resolve the per-tier ceiling. junub stays uncapped (NULL); plus
  -- and free get hard daily ceilings. An unknown tier value falls
  -- back to the free limit so a misconfigured row can't accidentally
  -- grant unlimited swipes.
  tier_limit := CASE effective
                  WHEN 'junub' THEN NULL
                  WHEN 'plus'  THEN plus_limit
                  ELSE              free_limit
                END;

  IF tier_limit IS NULL THEN
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
    'limit', tier_limit,
    'remaining', GREATEST(0, tier_limit - used),
    'unlimited', FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_like_status() TO authenticated;

-- Reload PostgREST so the updated function is picked up immediately.
NOTIFY pgrst, 'reload schema';
