-- 00031 — Add the tables the client *already subscribes to* (or is
-- about to subscribe to) to the supabase_realtime publication so
-- postgres_changes events actually fire.
--
-- Originally two subscriptions were silently no-oping because their
-- target tables weren't in the publication added by 00003:
--
--   • CommunityScreen.js:226   — Post INSERT/UPDATE/DELETE (feed live updates,
--                                 including like/comment/repost counters
--                                 driven by the 00017 triggers)
--   • ChatScreen.js:551        — MessageReaction INSERT/DELETE (live reactions)
--
-- Added in the same migration to keep the publication footprint
-- coherent with what the client cares about:
--
--   • Story INSERT  — StoriesRow.js subscribes (see realtime useEffect
--                     inside the component) so new stories surface in
--                     the horizontal strip without a tab refocus.
--
-- Adding a table to the publication has a small per-row write cost
-- (Postgres ships a WAL entry to the realtime worker) so we don't
-- enable it indiscriminately — only the tables the app actually
-- listens to. New tables go in here as their first subscription
-- ships in the client, NOT speculatively.
--
-- Realtime + RLS: the publication delivers raw row changes to the
-- realtime worker, which then re-applies RLS for each subscribed
-- client before forwarding. That means a user who can't SELECT a
-- row also can't subscribe to its changes — Post / MessageReaction
-- both have appropriate SELECT policies already.

-- Idempotent adds. `ALTER PUBLICATION ... ADD TABLE` errors if the
-- table is already a member, so we wrap each in a per-table guard
-- and silently skip already-published tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'Post'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Post";
    RAISE NOTICE '[00031] Added Post to supabase_realtime.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'MessageReaction'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "MessageReaction";
    RAISE NOTICE '[00031] Added MessageReaction to supabase_realtime.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'Story'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Story";
    RAISE NOTICE '[00031] Added Story to supabase_realtime.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
