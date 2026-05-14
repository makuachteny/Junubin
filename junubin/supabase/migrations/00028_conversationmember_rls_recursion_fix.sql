-- 00028 — Fix infinite-recursion error on ConversationMember SELECT.
--
-- Symptom (Postgres error 42P17):
--   "infinite recursion detected in policy for relation ConversationMember"
-- Triggered any time the client queried Message rows for a conversation
-- the user is in — MessagesScreen on focus, ChatScreen on open, push
-- handlers — so the inbox + all chats were unusable.
--
-- Root cause: 00002_rls.sql line 137-146 declared
--
--   CREATE POLICY "Members can read membership"
--       ON "ConversationMember" FOR SELECT
--       USING (
--           "userId" = public.current_user_id()
--           OR EXISTS (
--               SELECT 1 FROM "ConversationMember" cm2
--               WHERE cm2."conversationId" = "ConversationMember"."conversationId"
--               AND cm2."userId" = public.current_user_id()
--           )
--       );
--
-- The OR-branch tries to let a user see OTHER members of conversations
-- they're in, but doing so requires scanning ConversationMember itself,
-- which re-evaluates the same policy on every visited row — infinite
-- recursion.
--
-- Fix strategy:
--   1. SELECT policy now allows only the user's OWN membership row
--      (no recursive cross-row visibility).
--   2. To still let the user discover the OTHER participant in their
--      conversations (needed for things like push triggers and admin
--      tooling), expose a SECURITY DEFINER helper that bypasses RLS for
--      a narrowly-scoped membership check. Existing migrations already
--      use `EXISTS (SELECT 1 FROM ConversationMember WHERE userId = me)`
--      inside Message, MessageReaction, Whisper policies — those still
--      work because the only row they need to see is the caller's own,
--      which the simplified policy permits.
--
-- The client never queries ConversationMember directly for cross-member
-- discovery — Match rows already carry both participant ids — so the
-- simplification is safe.

DROP POLICY IF EXISTS "Members can read membership" ON "ConversationMember";

CREATE POLICY "Members can read own membership"
    ON "ConversationMember" FOR SELECT
    USING ("userId" = public.current_user_id());

-- Helper for server-side code (Edge Functions, triggers, future RLS
-- policies on related tables) that needs a non-recursive way to check
-- "is user X a member of conversation Y?". SECURITY DEFINER bypasses
-- RLS inside the function body so callers don't trip the recursion.
--
-- Both id columns are TEXT in our schema — Conversation.id is
-- `gen_random_uuid()::text` (00001_schema.sql:142) and User.id is the
-- same (00001:15). Declaring the parameters as UUID earlier caused a
-- 42883 "operator does not exist: text = uuid" because PostgREST
-- never coerces across types in policy lookups.
CREATE OR REPLACE FUNCTION public.is_conversation_member(
    _conversation_id TEXT,
    _user_id         TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM "ConversationMember"
        WHERE "conversationId" = _conversation_id
          AND "userId" = _user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(TEXT, TEXT)
  TO authenticated, anon, service_role;

-- Reload PostgREST so the new function is callable immediately.
SELECT pg_notify('pgrst', 'reload schema');
