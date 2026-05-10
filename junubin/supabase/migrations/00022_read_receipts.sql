-- 00022 — Read receipts on Message
--
-- Adds Message.readAt so the unread-message badge can clear server-side
-- and stay in sync across all of a user's devices. The previous
-- implementation tracked unread state purely in client local state, so
-- opening a chat on phone A left the badge stuck on phone B.
--
-- The companion RPC `mark_conversation_read` is the only writer of
-- `readAt`. SECURITY DEFINER (mirroring the pattern in 00012's
-- unmatch_user) so it can update Message rows without each row needing
-- a "markable by recipient" RLS policy on the table itself —
-- authorisation is enforced inside the function body (auth + member
-- check), and the function only flips `readAt` for messages the caller
-- did NOT send, which is the only sensible semantics.

-- ── 1. Schema: readAt + partial index ───────────────────────────────
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMPTZ;

-- Partial index on unread rows only — counting unread per conversation
-- is the hot query (matches list, badge). The WHERE clause keeps the
-- index small: once messages are marked read they leave the index.
CREATE INDEX IF NOT EXISTS "Message_unread_idx"
  ON "Message" ("conversationId", "senderId", "readAt")
  WHERE "readAt" IS NULL;

-- ── 2. mark_conversation_read RPC ───────────────────────────────────
-- Marks every inbound, still-unread message in the conversation as
-- read. Only the recipient (i.e. anyone who did NOT send the message)
-- can flip the bit; the caller's own messages are never touched.
-- Returns the count of rows updated so callers can decrement local
-- badge state if they want.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(conversation_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id        TEXT;
  is_member    BOOLEAN;
  marked_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF conversation_id IS NULL THEN
    RAISE EXCEPTION 'conversation_id required';
  END IF;

  SELECT id INTO me_id FROM "User" WHERE auth_id = auth.uid();
  IF me_id IS NULL THEN
    RAISE EXCEPTION 'no user row';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM "ConversationMember"
     WHERE "conversationId" = conversation_id
       AND "userId"         = me_id
  ) INTO is_member;

  IF NOT is_member THEN
    RAISE EXCEPTION 'not a member of this conversation';
  END IF;

  UPDATE "Message"
     SET "readAt" = NOW()
   WHERE "conversationId" = conversation_id
     AND "senderId"      <> me_id
     AND "readAt"         IS NULL;

  GET DIAGNOSTICS marked_count = ROW_COUNT;
  RETURN COALESCE(marked_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(TEXT) TO authenticated;
