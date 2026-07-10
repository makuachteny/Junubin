-- 00044 — Allow service_role to grant consumables (Stripe webhook fix).
--
-- ── Problem ────────────────────────────────────────────────────────
-- The `add_spotlights`, `add_superlikes`, `add_coins`, and
-- `add_whispers` RPCs from 00006 / 00007 guard against impersonation
-- by checking `auth.uid() <> user_auth_id`. This made the client path
-- safe (a user can only grant credits to themselves), but it
-- ALSO blocked the Stripe webhook from granting consumables — the
-- webhook runs under the service_role JWT, where `auth.uid()` is
-- NULL, so the guard rejected the call with "not authorized".
--
-- Effect in production: every Stripe consumable purchase (Spotlight,
-- Super Like, Coin pack) charged the user but failed to credit the
-- balance. Subscriptions were unaffected because the webhook updates
-- `User.subscriptionTier` directly via service_role (bypasses RLS) —
-- only the consumable code path went through these RPCs.
--
-- ── Fix ────────────────────────────────────────────────────────────
-- Replace the four `add_*` RPCs with versions that let the
-- service_role bypass the user check, while keeping the original
-- self-only rule for authenticated callers. This is the minimum
-- change — the `consume_*` and `try_consume_*` RPCs from 00014 are
-- already correct (they only execute under the authenticated role).
--
-- Idempotent: CREATE OR REPLACE FUNCTION rewrites the body without
-- dropping grants. Safe to re-run.

CREATE OR REPLACE FUNCTION public.add_coins(user_auth_id uuid, amount integer)
RETURNS TABLE (remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypass: the Stripe webhook (and any future server-side
  -- grant path — promo credits, support refunds, etc.) needs to credit
  -- arbitrary users. The role check is the authority — auth.uid() being
  -- NULL is not by itself evidence of service_role; an unauthenticated
  -- caller also has a NULL uid and must be refused.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RETURN QUERY
      SELECT "coins" FROM public."User" WHERE auth_id = user_auth_id;
    RETURN;
  END IF;

  UPDATE public."User"
    SET "coins" = "coins" + amount
    WHERE auth_id = user_auth_id
    RETURNING "coins" INTO remaining;

  RETURN QUERY SELECT remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_spotlights(user_auth_id uuid, amount integer)
RETURNS TABLE (remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RETURN QUERY SELECT "spotlights" FROM public."User" WHERE auth_id = user_auth_id;
    RETURN;
  END IF;

  UPDATE public."User"
    SET "spotlights" = "spotlights" + amount
    WHERE auth_id = user_auth_id
    RETURNING "spotlights" INTO remaining;

  RETURN QUERY SELECT remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_superlikes(user_auth_id uuid, amount integer)
RETURNS TABLE (remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RETURN QUERY SELECT "superLikes" FROM public."User" WHERE auth_id = user_auth_id;
    RETURN;
  END IF;

  UPDATE public."User"
    SET "superLikes" = "superLikes" + amount
    WHERE auth_id = user_auth_id
    RETURNING "superLikes" INTO remaining;

  RETURN QUERY SELECT remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_whispers(user_auth_id uuid, amount integer)
RETURNS TABLE (remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RETURN QUERY SELECT "whispers" FROM public."User" WHERE auth_id = user_auth_id;
    RETURN;
  END IF;

  UPDATE public."User"
    SET "whispers" = "whispers" + amount
    WHERE auth_id = user_auth_id
    RETURNING "whispers" INTO remaining;

  RETURN QUERY SELECT remaining;
END;
$$;

-- Explicit grants — re-affirms the existing authenticated grant and
-- keeps service_role's bypass (it has GRANT ALL by default on public).
GRANT EXECUTE ON FUNCTION public.add_coins(uuid, integer)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_spotlights(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_superlikes(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_whispers(uuid, integer)   TO authenticated;
