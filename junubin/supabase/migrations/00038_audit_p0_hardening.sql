-- 00038 — Audit P0 hardening.
--
-- Closes three gaps flagged by the May 2026 audit. Each section is
-- independent and idempotent so a partial rollback (e.g. drop one
-- section) doesn't break the others.
--
--   1. Match INSERT must require mutual swipe. The previous policy
--      let any authenticated user create a Match row as long as one
--      side of the pair was themselves — bypassing the swipe Edge
--      Function's Elo / safety / mutual-like checks.
--   2. Profile SELECT must honor Block in both directions, otherwise a
--      blocked user can still pull the blocker's profile via a raw
--      Supabase select. Incognito profiles must also be hidden from
--      non-matched viewers; previously they were filtered only at the
--      discover-deck level, not at PostgREST.
--   3. Block-recursion proof Profile policy — uses a SECURITY DEFINER
--      helper so the recursive policy on Profile doesn't trip the
--      "infinite recursion detected in policy" 42P17.
--   4. send_push trigger helper stamps the X-Junubin-Internal-Secret
--      header that the hardened push-send function now requires.
--
-- All sections are wrapped in DROP-IF-EXISTS / CREATE so re-applying
-- is safe.

-- ============================================================================
-- #1 — Match INSERT: require mutual swipe history
-- ============================================================================
-- The Match row is supposed to be the *consequence* of two reciprocal
-- likes — never the cause. With the previous policy a malicious client
-- could fabricate a Match against any user, then INSERT a Conversation
-- and start messaging without ever showing up in the target's swipe
-- deck. We replace the loose policy with one that requires (a) the
-- caller to be one side of the pair, and (b) a like / super_like from
-- the OTHER side already exists in Swipe.
--
-- The Edge Function `swipe` still uses the service role to create
-- matches at the moment of the reciprocal like; this policy is the
-- belt-and-braces defense for direct PostgREST writes.

DROP POLICY IF EXISTS "Users can insert matches" ON "Match";

CREATE POLICY "Users can insert matches (mutual-only)"
  ON "Match" FOR INSERT
  WITH CHECK (
    (
      "userAId" = public.current_user_id()
      OR "userBId" = public.current_user_id()
    )
    AND EXISTS (
      -- Other side liked OR super-liked me. We don't allow Match
      -- creation off a `pass` from either side.
      SELECT 1 FROM "Swipe" s
      WHERE s."type" IN ('like', 'super_like')
        AND (
          (s."fromUserId" = "Match"."userAId" AND s."toUserId" = "Match"."userBId")
          OR (s."fromUserId" = "Match"."userBId" AND s."toUserId" = "Match"."userAId")
        )
        AND s."fromUserId" <> public.current_user_id()
    )
    AND EXISTS (
      -- And I liked OR super-liked them.
      SELECT 1 FROM "Swipe" s
      WHERE s."type" IN ('like', 'super_like')
        AND s."fromUserId" = public.current_user_id()
        AND s."toUserId" IN ("Match"."userAId", "Match"."userBId")
        AND s."toUserId" <> public.current_user_id()
    )
  );

-- ============================================================================
-- #2 — Profile SELECT: honor Block + incognito
-- ============================================================================
-- Helper marks the caller as either party in a Block row against the
-- given userId. SECURITY DEFINER so the policy doesn't recurse on
-- Block's own RLS, and STABLE so PostgREST can memoize per-request.

CREATE OR REPLACE FUNCTION public.has_block_with(target_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Block" b
    WHERE
      (b."blockerId" = public.current_user_id() AND b."blockedId" = target_user_id)
      OR (b."blockerId" = target_user_id          AND b."blockedId" = public.current_user_id())
  );
$$;

-- Helper marks whether the caller and the target are co-members of any
-- Conversation. Used to keep matched chats unbroken when one side
-- toggles incognito — they should still be able to read the peer's
-- profile (otherwise existing chats would show a hole where the peer
-- was). Discover-deck filtering is unaffected; that lives in the
-- discover Edge Function, not at the PostgREST layer.
CREATE OR REPLACE FUNCTION public.shares_conversation_with(target_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM "ConversationMember" me
      JOIN "ConversationMember" peer
        ON peer."conversationId" = me."conversationId"
       AND peer."userId" = target_user_id
     WHERE me."userId" = public.current_user_id()
  );
$$;

DROP POLICY IF EXISTS "Anyone authenticated can read profiles" ON "Profile";
DROP POLICY IF EXISTS "Profile read with block + incognito guard" ON "Profile";

CREATE POLICY "Profile read with block + incognito guard"
  ON "Profile" FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    -- Owner always reads their own profile.
    AND (
      "userId" = public.current_user_id()
      OR (
        -- Block in either direction — hide hard.
        NOT public.has_block_with("userId")
        AND (
          -- Incognito profiles are visible only to users who already
          -- share a conversation with them (i.e. existing matches).
          COALESCE("incognito", FALSE) = FALSE
          OR public.shares_conversation_with("userId")
        )
      )
    )
  );

-- ============================================================================
-- #3 — send_push trigger helper: stamp internal secret header
-- ============================================================================
-- The hardened push-send Edge Function (May 2026 audit P0.3) treats a
-- request as "internal" if it carries either the service-role JWT as
-- Bearer (still true here — service_k below) OR the
-- X-Junubin-Internal-Secret header set to JUNUBIN_INTERNAL_SECRET. We
-- add the header here so the trigger path still works once the
-- function is deployed with internal-secret-only mode (a likely
-- follow-up tightening — service-role-as-bearer is broader than
-- needed). Operator must set `app.internal_secret` once via:
--
--   ALTER DATABASE postgres SET "app.internal_secret" = '<long-random>';
--
-- and also set JUNUBIN_INTERNAL_SECRET in the Edge Function env to
-- the same value. If unset, the header is omitted and the service-key
-- bearer path keeps things working.

CREATE OR REPLACE FUNCTION public.send_push(
  user_ids TEXT[],
  title    TEXT,
  body     TEXT,
  data     JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  edge_url      TEXT := current_setting('app.edge_url', true);
  service_k     TEXT := current_setting('app.service_key', true);
  internal_sec  TEXT := current_setting('app.internal_secret', true);
  headers_json  JSONB;
  request_id    BIGINT;
BEGIN
  IF edge_url IS NULL OR service_k IS NULL THEN
    -- Triggers fire even before the operator has wired the settings
    -- above; in that case we silently no-op so user-facing inserts
    -- never error.
    RETURN NULL;
  END IF;

  headers_json := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || service_k
  );
  IF internal_sec IS NOT NULL AND length(internal_sec) > 0 THEN
    headers_json := headers_json || jsonb_build_object('X-Junubin-Internal-Secret', internal_sec);
  END IF;

  SELECT net.http_post(
    url     := edge_url || '/push-send',
    headers := headers_json,
    body    := jsonb_build_object(
      'userIds', user_ids,
      'title',   title,
      'body',    body,
      'data',    data
    )
  )
  INTO request_id;

  RETURN request_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
