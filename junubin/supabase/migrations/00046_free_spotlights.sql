-- 00046 — Free spotlight activation.
--
-- JuNubin is free end-to-end, so spotlight activation must mark the
-- profile as boosted without decrementing a paid consumable balance.
-- The function name stays the same because the app already calls
-- try_consume_spotlight() for the real spotlight backend behavior.

CREATE OR REPLACE FUNCTION public.try_consume_spotlight()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  me_id TEXT;
  cur_balance INTEGER;
  until TIMESTAMPTZ;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'unauthenticated'); END IF;

  SELECT id, COALESCE(spotlights, 0)
    INTO me_id, cur_balance
    FROM "User"
   WHERE auth_id = uid;
  IF me_id IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'no_user'); END IF;

  IF EXISTS (SELECT 1 FROM "User" WHERE id = me_id AND "moderationStatus" <> 'active') THEN
    RETURN json_build_object('ok', false, 'reason', 'restricted');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Profile" WHERE "userId" = me_id AND "surveyCompletedAt" IS NOT NULL
  ) THEN
    RETURN json_build_object('ok', false, 'reason', 'survey_required');
  END IF;

  until := now() + INTERVAL '30 minutes';
  UPDATE "Profile"
     SET "spotlightedUntil" = until
   WHERE "userId" = me_id;

  RETURN json_build_object(
    'ok', true,
    'balance', cur_balance,
    'spotlightedUntil', until
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_consume_spotlight() TO authenticated;

NOTIFY pgrst, 'reload schema';
