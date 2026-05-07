-- 00013 — Push notification triggers.
--
-- Fires the `push-send` Edge Function via `pg_net` whenever:
--
--   * A Match row is inserted    → both users get a "It's a Match!" push
--   * A Message row is inserted  → other conversation member(s) get a chat preview
--   * A Follow row is inserted   → the followee gets a "X started following you" push
--
-- pg_net is async (`net.http_post` returns a request id immediately and
-- does the actual HTTP off the transaction), so the triggers won't slow
-- the user-facing inserts. Failures land in `net._http_response` and
-- can be surfaced via Supabase's logs.
--
-- Setup (one-time per project — run BEFORE applying this migration):
--
--   1. Enable pg_net in Supabase dashboard → Database → Extensions
--   2. Set the Edge Function base URL once at the DB level so the
--      triggers don't have to know it:
--        ALTER DATABASE postgres
--          SET app.edge_url = 'https://<project-ref>.supabase.co/functions/v1';
--      Replace <project-ref> with `uvtyiytbgkasemabtznc`.
--   3. Set the service-role key for the trigger to authenticate as:
--        ALTER DATABASE postgres
--          SET app.service_key = '<your service role key>';
--      Service role bypasses RLS, which is what we want for system pushes.
--
-- After those three steps, applying this migration creates the triggers
-- and pushes flow automatically.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: fire-and-forget POST to the push-send Edge Function.
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
  edge_url   TEXT := current_setting('app.edge_url', true);
  service_k  TEXT := current_setting('app.service_key', true);
  request_id BIGINT;
BEGIN
  IF edge_url IS NULL OR service_k IS NULL THEN
    -- Triggers fire even before the operator has wired the settings
    -- above; in that case we silently no-op so user-facing inserts
    -- never error. The migration's leading comment block is the
    -- nudge to the operator.
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := edge_url || '/push-send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_k
    ),
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

-- ── Match insert → "It's a match!" ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  name1 TEXT;
  name2 TEXT;
BEGIN
  SELECT "displayName" INTO name1 FROM "User" WHERE id = NEW."userAId";
  SELECT "displayName" INTO name2 FROM "User" WHERE id = NEW."userBId";

  PERFORM public.send_push(
    ARRAY[NEW."userAId"],
    'It''s a Match! 💛',
    coalesce(name2, 'Someone') || ' liked you back. Say hi!',
    jsonb_build_object('type', 'match', 'matchId', NEW.id, 'peerId', NEW."userBId")
  );
  PERFORM public.send_push(
    ARRAY[NEW."userBId"],
    'It''s a Match! 💛',
    coalesce(name1, 'Someone') || ' liked you back. Say hi!',
    jsonb_build_object('type', 'match', 'matchId', NEW.id, 'peerId', NEW."userAId")
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match ON "Match";
CREATE TRIGGER trg_notify_match
  AFTER INSERT ON "Match"
  FOR EACH ROW EXECUTE FUNCTION public.notify_match();

-- ── Message insert → "<sender>: <preview>" ──────────────────────────
CREATE OR REPLACE FUNCTION public.notify_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sender_name TEXT;
  preview     TEXT;
  recipients  TEXT[];
BEGIN
  -- Only push real chat. The MessageType enum (00001 + 00005) is
  -- ('text','image','audio','game'); 'game' is in-conversation game
  -- state, not something a recipient wants a banner for, so skip it.
  -- Anything new added to the enum later defaults to "skip" until we
  -- explicitly opt it in here.
  IF NEW.type IS NULL OR NEW.type NOT IN ('text', 'image', 'audio') THEN
    RETURN NEW;
  END IF;

  SELECT "displayName" INTO sender_name FROM "User" WHERE id = NEW."senderId";

  preview := CASE NEW.type
    WHEN 'audio' THEN '🎙 Voice note'
    WHEN 'image' THEN '📷 Photo'
    ELSE substring(coalesce(NEW.body, ''), 1, 120)
  END;

  -- Everyone in the conversation EXCEPT the sender.
  SELECT array_agg("userId")
    INTO recipients
    FROM "ConversationMember"
    WHERE "conversationId" = NEW."conversationId"
      AND "userId" <> NEW."senderId";

  IF recipients IS NULL OR array_length(recipients, 1) = 0 THEN
    RETURN NEW;
  END IF;

  PERFORM public.send_push(
    recipients,
    coalesce(sender_name, 'New message'),
    preview,
    jsonb_build_object(
      'type', 'message',
      'conversationId', NEW."conversationId",
      'messageId', NEW.id,
      'senderId', NEW."senderId"
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message ON "Message";
CREATE TRIGGER trg_notify_message
  AFTER INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION public.notify_message();

-- ── Follow insert → "X started following you" ───────────────────────
CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT "displayName" INTO follower_name FROM "User" WHERE id = NEW."followerId";

  PERFORM public.send_push(
    ARRAY[NEW."followingId"],
    'New follower',
    coalesce(follower_name, 'Someone') || ' started following you',
    jsonb_build_object('type', 'follow', 'followerId', NEW."followerId")
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow ON "Follow";
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON "Follow"
  FOR EACH ROW EXECUTE FUNCTION public.notify_follow();
