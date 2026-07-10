-- 00045 — MessageReaction table (closes the gap from 00031).
--
-- ── Problem ────────────────────────────────────────────────────────
-- Migration 00031_realtime_publication_expand.sql wraps an
-- `ALTER PUBLICATION supabase_realtime ADD TABLE "MessageReaction"`
-- inside a `DO`-block existence check, so adding it to the publication
-- was made a no-op when the table is absent. The table was never
-- created in any prior migration, but the client uses it in three
-- places that have been silently failing in production:
--
--   • src/api/services/chatService.js:352  — toggle/insert reactions
--   • src/api/services/chatService.js:392  — bulk fetch on chat open
--   • src/screens/ChatScreen.js:648-649    — Realtime subscription
--
-- This migration creates the table, attaches it to RLS, and re-runs
-- the publication add so live reaction updates start working without
-- redeploying 00031.
--
-- ── Schema rationale ───────────────────────────────────────────────
-- TEXT id (matches Message/User); FK cascades on both parents so
-- deleting a message or user collapses their reactions atomically.
-- Composite unique on (messageId, userId, emoji) is required by the
-- toggle semantics in chatService.toggleMessageReaction — the client
-- first looks up (`maybeSingle`) then either deletes or inserts.

CREATE TABLE IF NOT EXISTS "MessageReaction" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MessageReaction_messageId_fkey'
    ) THEN
        ALTER TABLE "MessageReaction"
            ADD CONSTRAINT "MessageReaction_messageId_fkey"
            FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MessageReaction_userId_fkey'
    ) THEN
        ALTER TABLE "MessageReaction"
            ADD CONSTRAINT "MessageReaction_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "MessageReaction_message_user_emoji_key"
    ON "MessageReaction"("messageId", "userId", "emoji");

-- Supports the bulk `getReactions(messageIds)` lookup in chatService —
-- the IN-list scan is cheap when the leading column is indexed.
CREATE INDEX IF NOT EXISTS "MessageReaction_messageId_idx"
    ON "MessageReaction"("messageId");

-- ── RLS ────────────────────────────────────────────────────────────
-- Same membership rule as Message: a row is visible / writable iff the
-- caller is in the parent message's conversation. INSERT additionally
-- forces userId = me, and DELETE is restricted to the row's owner so
-- users can only remove their own reactions.

ALTER TABLE "MessageReaction" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read message reactions" ON "MessageReaction";
CREATE POLICY "Members can read message reactions"
    ON "MessageReaction" FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "Message" m
            JOIN "ConversationMember" cm
              ON cm."conversationId" = m."conversationId"
            WHERE m."id" = "MessageReaction"."messageId"
              AND cm."userId" = public.current_user_id()
        )
    );

DROP POLICY IF EXISTS "Members can add reactions" ON "MessageReaction";
CREATE POLICY "Members can add reactions"
    ON "MessageReaction" FOR INSERT
    WITH CHECK (
        "userId" = public.current_user_id()
        AND EXISTS (
            SELECT 1
            FROM "Message" m
            JOIN "ConversationMember" cm
              ON cm."conversationId" = m."conversationId"
            WHERE m."id" = "MessageReaction"."messageId"
              AND cm."userId" = public.current_user_id()
        )
    );

DROP POLICY IF EXISTS "Users can remove own reactions" ON "MessageReaction";
CREATE POLICY "Users can remove own reactions"
    ON "MessageReaction" FOR DELETE
    USING ("userId" = public.current_user_id());

-- ── Realtime ───────────────────────────────────────────────────────
-- 00031 ran an idempotent add that no-op'd because the table didn't
-- exist. Repeat the add now — the existence guard makes the call safe
-- to re-run on environments where 00031 succeeded later.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'MessageReaction'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE "MessageReaction";
        RAISE NOTICE '[00045] Added MessageReaction to supabase_realtime.';
    END IF;
END $$;
