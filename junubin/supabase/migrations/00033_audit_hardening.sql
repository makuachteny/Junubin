-- 00033 — Audit hardening (build 22 follow-up).
--
-- Three server-side fixes the iOS audit flagged. Each one closes a gap
-- where the client was the only line of defense; a patched / non-app
-- caller could previously bypass.
--
--   1. Report dedupe — block a single reporter from filing duplicate
--      reports against the same person. Client-side check helps but
--      can be raced; DB unique constraint is the real guard.
--   2. Post visibility — RLS used to return EVERY post regardless of
--      moderationStatus. Client filters on `approved`, but a direct
--      Supabase query (or a logged-in scraper) could pull unreviewed
--      content. Authors still see their own pending posts.
--   3. Message blocking — the existing Message INSERT policy only
--      verifies membership in the conversation; it ignored the Block
--      table entirely. A blocked user could still DM the blocker in
--      a previously-active thread.
--
-- All three are idempotent — safe to re-apply on a DB that's already
-- been patched.

-- ── 1. Report unique (reporterId, reportedId) ────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "Report_reporter_reported_key"
  ON "Report" ("reporterId", "reportedId");

-- ── 2. Post visibility — approved-or-own ─────────────────────────────
DROP POLICY IF EXISTS "Posts readable by all" ON "Post";
DROP POLICY IF EXISTS "Posts readable when approved or own" ON "Post";

CREATE POLICY "Posts readable when approved or own"
  ON "Post" FOR SELECT
  USING (
    "moderationStatus" = 'approved'
    OR "userId" = public.current_user_id()
  );

-- ── 3. Message INSERT — honor Block in both directions ───────────────
DROP POLICY IF EXISTS "Conversation members can send messages" ON "Message";

CREATE POLICY "Conversation members can send messages"
  ON "Message" FOR INSERT
  WITH CHECK (
    "senderId" = public.current_user_id()
    AND EXISTS (
      SELECT 1 FROM "ConversationMember"
      WHERE "ConversationMember"."conversationId" = "Message"."conversationId"
        AND "ConversationMember"."userId" = public.current_user_id()
    )
    -- Neither party may have blocked the other. Looks at both
    -- (blocker = sender, blocked = peer) and (blocker = peer,
    -- blocked = sender) so a block placed by either side cuts the
    -- conversation off immediately.
    AND NOT EXISTS (
      SELECT 1 FROM "Block" b
      JOIN "ConversationMember" cm
        ON cm."conversationId" = "Message"."conversationId"
       AND cm."userId" <> public.current_user_id()
      WHERE (b."blockerId" = public.current_user_id() AND b."blockedId" = cm."userId")
         OR (b."blockerId" = cm."userId" AND b."blockedId" = public.current_user_id())
    )
  );

NOTIFY pgrst, 'reload schema';
