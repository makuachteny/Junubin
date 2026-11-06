-- 00048 — get_or_create_direct_conversation
--
-- Closes the gap the launch flow-review found: `accept_message_request`
-- (00047) was the ONLY path that minted a Conversation, so two people
-- who became mutual connections by following each other — never via a
-- message request — had no thread. The client's "Message" button
-- navigated to a Chat screen with no conversationId, which rendered a
-- composer whose sends went nowhere.
--
-- This RPC is the direct-chat mint path. It is consent-gated server-side
-- exactly like the client's canMessageDirectly logic:
--   • the pair are mutual follows (a follows b AND b follows a), OR
--   • an accepted MessageRequest exists between them (either direction), OR
--   • a conversation already exists for the pair (legacy Match era).
-- Anyone else gets `not_connected` and must go through a message request.
--
-- Blocks are respected: any Block row between the pair refuses.
-- Mint logic mirrors accept_message_request (pairKey Match + Conversation
-- + both memberships, "It's a Match!" push suppressed).

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(peer_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id     TEXT;
  conv_id   TEXT;
  match_id  TEXT;
  pair_key  TEXT;
  user_a    TEXT;
  user_b    TEXT;
  connected BOOLEAN := FALSE;
BEGIN
  me_id := public.current_user_id();
  IF me_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF peer_id IS NULL OR peer_id = me_id THEN
    RAISE EXCEPTION 'invalid_peer';
  END IF;

  -- Blocks in either direction refuse outright.
  IF EXISTS (
    SELECT 1 FROM "Block"
     WHERE ("blockerId" = me_id  AND "blockedId" = peer_id)
        OR ("blockerId" = peer_id AND "blockedId" = me_id)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- Existing conversation between the pair always wins (also covers
  -- the legacy Match era and previously accepted requests).
  SELECT cm1."conversationId" INTO conv_id
    FROM "ConversationMember" cm1
    JOIN "ConversationMember" cm2
      ON cm2."conversationId" = cm1."conversationId"
   WHERE cm1."userId" = me_id
     AND cm2."userId" = peer_id
   ORDER BY cm1."joinedAt" ASC
   LIMIT 1;
  IF conv_id IS NOT NULL THEN
    -- Ensure both memberships exist even on the reuse path (a legacy
    -- row could predate the member backfill).
    INSERT INTO "ConversationMember" ("conversationId", "userId")
         VALUES (conv_id, me_id), (conv_id, peer_id)
    ON CONFLICT ("conversationId", "userId") DO NOTHING;
    RETURN conv_id;
  END IF;

  -- Consent gate: mutual follow, or an accepted request either way.
  SELECT EXISTS (
    SELECT 1 FROM "Follow" f1
    JOIN "Follow" f2
      ON f2."followerId" = f1."followingId"
     AND f2."followingId" = f1."followerId"
   WHERE f1."followerId" = me_id
     AND f1."followingId" = peer_id
  ) OR EXISTS (
    SELECT 1 FROM "MessageRequest"
     WHERE status = 'accepted'
       AND (("fromUserId" = me_id  AND "toUserId" = peer_id)
         OR ("fromUserId" = peer_id AND "toUserId" = me_id))
  ) INTO connected;

  IF NOT connected THEN
    RAISE EXCEPTION 'not_connected';
  END IF;

  user_a   := LEAST(me_id, peer_id);
  user_b   := GREATEST(me_id, peer_id);
  pair_key := user_a || ':' || user_b;

  PERFORM set_config('junubin.suppress_match_push', 'on', true);

  SELECT id INTO match_id FROM "Match" WHERE "pairKey" = pair_key;
  IF match_id IS NULL THEN
    INSERT INTO "Match" ("pairKey", "userAId", "userBId", "mode", "status")
         VALUES (pair_key, user_a, user_b, 'social', 'active')
      RETURNING id INTO match_id;
  ELSE
    UPDATE "Match" SET "status" = 'active', "updatedAt" = NOW() WHERE id = match_id;
  END IF;

  SELECT id INTO conv_id FROM "Conversation" WHERE "matchId" = match_id;
  IF conv_id IS NULL THEN
    INSERT INTO "Conversation" ("matchId") VALUES (match_id) RETURNING id INTO conv_id;
  END IF;

  INSERT INTO "ConversationMember" ("conversationId", "userId")
       VALUES (conv_id, me_id), (conv_id, peer_id)
  ON CONFLICT ("conversationId", "userId") DO NOTHING;

  RETURN conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(TEXT) TO authenticated;
