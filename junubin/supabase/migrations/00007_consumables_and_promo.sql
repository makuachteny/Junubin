-- Economy: consumables + promo tier + ads

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "spotlights" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "superLikes" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "whispers" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "promoTier" TEXT,
  ADD COLUMN IF NOT EXISTS "promoEndsAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "adsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.add_spotlights(user_auth_id uuid, amount integer)
RETURNS TABLE (remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
    RAISE EXCEPTION 'not authorized';
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

CREATE OR REPLACE FUNCTION public.consume_spotlight(user_auth_id uuid, amount integer)
RETURNS TABLE (remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF amount IS NULL OR amount <= 0 THEN
    RETURN QUERY SELECT "spotlights" FROM public."User" WHERE auth_id = user_auth_id;
    RETURN;
  END IF;
  UPDATE public."User"
    SET "spotlights" = GREATEST("spotlights" - amount, 0)
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
  IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
    RAISE EXCEPTION 'not authorized';
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

CREATE OR REPLACE FUNCTION public.consume_superlike(user_auth_id uuid, amount integer)
RETURNS TABLE (remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF amount IS NULL OR amount <= 0 THEN
    RETURN QUERY SELECT "superLikes" FROM public."User" WHERE auth_id = user_auth_id;
    RETURN;
  END IF;
  UPDATE public."User"
    SET "superLikes" = GREATEST("superLikes" - amount, 0)
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
  IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
    RAISE EXCEPTION 'not authorized';
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

CREATE OR REPLACE FUNCTION public.consume_whisper(user_auth_id uuid, amount integer)
RETURNS TABLE (remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF amount IS NULL OR amount <= 0 THEN
    RETURN QUERY SELECT "whispers" FROM public."User" WHERE auth_id = user_auth_id;
    RETURN;
  END IF;
  UPDATE public."User"
    SET "whispers" = GREATEST("whispers" - amount, 0)
    WHERE auth_id = user_auth_id
    RETURNING "whispers" INTO remaining;
  RETURN QUERY SELECT remaining;
END;
$$;
