-- Economy: coins balance + RPC helpers

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "coins" INTEGER NOT NULL DEFAULT 100;

CREATE OR REPLACE FUNCTION public.deduct_coins(user_auth_id uuid, amount integer)
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
    RETURN QUERY
      SELECT "coins" FROM public."User" WHERE auth_id = user_auth_id;
    RETURN;
  END IF;

  UPDATE public."User"
    SET "coins" = GREATEST("coins" - amount, 0)
    WHERE auth_id = user_auth_id
    RETURNING "coins" INTO remaining;

  RETURN QUERY SELECT remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_coins(user_auth_id uuid, amount integer)
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
