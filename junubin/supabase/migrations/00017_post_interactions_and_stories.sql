-- 00017 — Post interactions (likes, comments, reposts) + Stories.
--
-- Bundles four additions that the client UI was already showing but
-- which had no persistence:
--
--   1. `PostLike` — per-user like on a Post; trigger keeps
--      Post.likeCount in sync. Unique on (postId, userId).
--   2. `PostComment` — comments + one level of replies (parentId).
--      Trigger keeps Post.commentCount in sync.
--   3. `PostRepost` — per-user repost record; trigger keeps
--      Post.repostCount in sync. Unique on (postId, userId).
--   4. `Story` — 24h ephemeral stories. mediaPath references the new
--      `stories` storage bucket (public-read, owner-write).

-- ── 1. PostLike ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PostLike" (
  "id"        TEXT PRIMARY KEY,
  "postId"    TEXT NOT NULL REFERENCES "Post"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PostLike_uniq" UNIQUE ("postId", "userId")
);

CREATE INDEX IF NOT EXISTS "PostLike_post_idx" ON "PostLike" ("postId");
CREATE INDEX IF NOT EXISTS "PostLike_user_idx" ON "PostLike" ("userId", "createdAt" DESC);

ALTER TABLE "PostLike" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes readable by all"
  ON "PostLike" FOR SELECT USING (TRUE);

CREATE POLICY "Liker can insert own like"
  ON "PostLike" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PostLike"."userId"
    )
  );

CREATE POLICY "Liker can delete own like"
  ON "PostLike" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PostLike"."userId"
    )
  );

-- ── 2. PostComment ──────────────────────────────────────────────────
-- One level of threading via parentId. PostDetailScreen renders
-- top-level comments and a "View N replies" expander per thread; that
-- maps cleanly to one parent reference per row.
CREATE TABLE IF NOT EXISTS "PostComment" (
  "id"        TEXT PRIMARY KEY,
  "postId"    TEXT NOT NULL REFERENCES "Post"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "parentId"  TEXT REFERENCES "PostComment"("id") ON DELETE CASCADE,
  "content"   TEXT NOT NULL CHECK (char_length("content") BETWEEN 1 AND 2000),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PostComment_post_idx"
  ON "PostComment" ("postId", "createdAt" ASC);
CREATE INDEX IF NOT EXISTS "PostComment_parent_idx"
  ON "PostComment" ("parentId", "createdAt" ASC)
  WHERE "parentId" IS NOT NULL;

ALTER TABLE "PostComment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments readable by all"
  ON "PostComment" FOR SELECT USING (TRUE);

CREATE POLICY "Author can insert own comment"
  ON "PostComment" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PostComment"."userId"
    )
  );

CREATE POLICY "Author can delete own comment"
  ON "PostComment" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PostComment"."userId"
    )
  );

-- ── 3. PostRepost ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PostRepost" (
  "id"        TEXT PRIMARY KEY,
  "postId"    TEXT NOT NULL REFERENCES "Post"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PostRepost_uniq" UNIQUE ("postId", "userId")
);

CREATE INDEX IF NOT EXISTS "PostRepost_post_idx" ON "PostRepost" ("postId");
CREATE INDEX IF NOT EXISTS "PostRepost_user_idx" ON "PostRepost" ("userId", "createdAt" DESC);

ALTER TABLE "PostRepost" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reposts readable by all"
  ON "PostRepost" FOR SELECT USING (TRUE);

CREATE POLICY "Reposter can insert own repost"
  ON "PostRepost" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PostRepost"."userId"
    )
  );

CREATE POLICY "Reposter can delete own repost"
  ON "PostRepost" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PostRepost"."userId"
    )
  );

-- ── 4. Counter triggers ─────────────────────────────────────────────
-- Keep Post.{like,comment,repost}Count in sync with the underlying
-- rows. SECURITY DEFINER so the counter UPDATEs aren't blocked by the
-- author-only Post UPDATE policy when a non-author likes/comments.
CREATE OR REPLACE FUNCTION public._post_like_count_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Post" SET "likeCount" = "likeCount" + 1 WHERE id = NEW."postId";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Post" SET "likeCount" = GREATEST("likeCount" - 1, 0) WHERE id = OLD."postId";
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS post_like_count_trg ON "PostLike";
CREATE TRIGGER post_like_count_trg
  AFTER INSERT OR DELETE ON "PostLike"
  FOR EACH ROW EXECUTE FUNCTION public._post_like_count_sync();

CREATE OR REPLACE FUNCTION public._post_comment_count_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Post" SET "commentCount" = "commentCount" + 1 WHERE id = NEW."postId";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Post" SET "commentCount" = GREATEST("commentCount" - 1, 0) WHERE id = OLD."postId";
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS post_comment_count_trg ON "PostComment";
CREATE TRIGGER post_comment_count_trg
  AFTER INSERT OR DELETE ON "PostComment"
  FOR EACH ROW EXECUTE FUNCTION public._post_comment_count_sync();

CREATE OR REPLACE FUNCTION public._post_repost_count_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Post" SET "repostCount" = "repostCount" + 1 WHERE id = NEW."postId";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Post" SET "repostCount" = GREATEST("repostCount" - 1, 0) WHERE id = OLD."postId";
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS post_repost_count_trg ON "PostRepost";
CREATE TRIGGER post_repost_count_trg
  AFTER INSERT OR DELETE ON "PostRepost"
  FOR EACH ROW EXECUTE FUNCTION public._post_repost_count_sync();

-- ── 5. Story ────────────────────────────────────────────────────────
-- 24h ephemeral content. expiresAt defaults to NOW() + 24h on insert;
-- listActiveStories filters on it client-side, and an optional cleanup
-- job (cron / pg_cron) can DELETE rows past expiry to reclaim storage.
CREATE TABLE IF NOT EXISTS "Story" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "mediaUrl"   TEXT,
  "mediaPath"  TEXT,
  "mediaType"  TEXT NOT NULL DEFAULT 'image'
    CHECK ("mediaType" IN ('image', 'video', 'text')),
  "content"    TEXT,                 -- caption or text-only story body
  "bgColor"    TEXT,                 -- background colour for text-only stories
  "viewCount"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt"  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS "Story_user_idx"    ON "Story" ("userId", "createdAt" DESC);
-- Plain B-tree on expiresAt — `WHERE "expiresAt" > NOW()` queries from
-- listActiveStoryGroups will use it. A partial-index predicate isn't
-- possible here because NOW() is STABLE, not IMMUTABLE.
CREATE INDEX IF NOT EXISTS "Story_expires_idx" ON "Story" ("expiresAt");

ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;

-- Stories are public to all signed-in users (mirrors Post's "readable
-- by all" pattern). Expiry filtering is enforced at the query level —
-- expired rows still exist but the client doesn't fetch them.
CREATE POLICY "Stories readable by authenticated"
  ON "Story" FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Author can insert own story"
  ON "Story" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Story"."userId"
    )
  );

CREATE POLICY "Author can delete own story"
  ON "Story" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Story"."userId"
    )
  );

-- ── 6. Stories storage bucket ───────────────────────────────────────
-- Public-read so the UI can render cached URLs without re-signing on
-- each view. Owner-write gated by path prefix (storage.foldername(name)[1]
-- must equal the caller's User.id), matching the pattern from 00012.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('stories', 'stories', TRUE)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Stories img public read"  ON storage.objects;
DROP POLICY IF EXISTS "Stories img owner write"  ON storage.objects;
DROP POLICY IF EXISTS "Stories img owner update" ON storage.objects;
DROP POLICY IF EXISTS "Stories img owner delete" ON storage.objects;

CREATE POLICY "Stories img public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stories');

CREATE POLICY "Stories img owner write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stories'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Stories img owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'stories'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Stories img owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'stories'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );
