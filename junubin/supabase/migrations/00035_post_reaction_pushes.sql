-- 00035 — Push notifications for post reactions.
--
-- The 00013 migration already wired pushes for matches, messages, and
-- follows via pg_net → push-send. This extends the same pattern to
-- post interactions so a post author gets a push when someone
-- engages: like, comment, repost, wave (added in 00034).
--
-- All triggers AFTER INSERT, SECURITY DEFINER, and self-skip (an
-- author liking their own post or commenting on it does not push).
-- They all reuse the `public.send_push(user_ids, title, body, data)`
-- helper from 00013 — that helper silently no-ops if the operator
-- hasn't set `app.edge_url` / `app.service_key`, so applying this
-- migration on a fresh DB doesn't error before push is configured.
--
-- Coalescing is intentionally NOT implemented in this pass — push
-- fatigue research (>5/week → 64% delete) means a viral post could
-- spam the author. v1.1 enhancement: aggregate "10 people liked your
-- post" via a 5-minute batch window. For now, every reaction = one
-- push so the author sees real-time engagement.

-- Resolve the post author + reactor's display name in one shot so
-- the trigger doesn't have to write a join each time.
CREATE OR REPLACE FUNCTION public.notify_post_reaction(
  in_post_id  TEXT,
  in_actor_id TEXT,
  in_verb     TEXT,             -- 'liked' | 'commented on' | 'reposted' | 'waved at'
  in_kind     TEXT              -- 'like' | 'comment' | 'repost' | 'wave' — push data discriminator
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_id   TEXT;
  actor_name  TEXT;
BEGIN
  -- Self-reactions don't notify.
  SELECT "userId" INTO author_id FROM "Post" WHERE "id" = in_post_id;
  IF author_id IS NULL OR author_id = in_actor_id THEN
    RETURN;
  END IF;

  SELECT COALESCE("displayName", 'Someone') INTO actor_name
    FROM "User" WHERE "id" = in_actor_id;

  PERFORM public.send_push(
    ARRAY[author_id],
    'JuNubin',
    actor_name || ' ' || in_verb || ' your post',
    jsonb_build_object(
      'type',    'post_reaction',
      'kind',    in_kind,
      'postId',  in_post_id,
      'actorId', in_actor_id
    )
  );
END;
$$;

-- ── Like → push ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.notify_post_reaction(NEW."postId", NEW."userId", 'liked', 'like');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PostLike_push" ON "PostLike";
CREATE TRIGGER "PostLike_push"
  AFTER INSERT ON "PostLike"
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

-- ── Comment → push ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.notify_post_reaction(NEW."postId", NEW."userId", 'commented on', 'comment');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PostComment_push" ON "PostComment";
CREATE TRIGGER "PostComment_push"
  AFTER INSERT ON "PostComment"
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

-- ── Repost → push ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_post_repost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.notify_post_reaction(NEW."postId", NEW."userId", 'reposted', 'repost');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PostRepost_push" ON "PostRepost";
CREATE TRIGGER "PostRepost_push"
  AFTER INSERT ON "PostRepost"
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_repost();

-- ── Wave → push ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_post_wave()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.notify_post_reaction(NEW."postId", NEW."userId", 'waved at', 'wave');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PostWave_push" ON "PostWave";
CREATE TRIGGER "PostWave_push"
  AFTER INSERT ON "PostWave"
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_wave();

NOTIFY pgrst, 'reload schema';
