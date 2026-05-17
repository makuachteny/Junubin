-- 00034 — Post waves (the fourth interaction primitive).
--
-- Up to now the Wave (the GraffitiWave icon in PostCard's action row)
-- was a local-only "I see you" gesture — it animated on tap but
-- nothing persisted, so two viewers could each wave at a post and
-- neither would know about the other. This migration promotes Wave
-- to a first-class interaction alongside Like / Comment / Repost so
-- counts show, and the count is durable across sessions and devices.
--
-- Schema mirrors PostLike / PostRepost (00017) for consistency:
--   PostWave(id, postId, userId, createdAt)
--   Unique on (postId, userId) — toggle is delete-then-reinsert
--   Post.waveCount kept in sync via AFTER INSERT / DELETE triggers

-- ── 1. PostWave table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PostWave" (
  "id"        TEXT PRIMARY KEY,
  "postId"    TEXT NOT NULL REFERENCES "Post"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PostWave_uniq" UNIQUE ("postId", "userId")
);

CREATE INDEX IF NOT EXISTS "PostWave_post_idx" ON "PostWave" ("postId");
CREATE INDEX IF NOT EXISTS "PostWave_user_idx" ON "PostWave" ("userId", "createdAt" DESC);

ALTER TABLE "PostWave" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Waves readable by all"
  ON "PostWave" FOR SELECT USING (TRUE);

CREATE POLICY "User can wave for self"
  ON "PostWave" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PostWave"."userId"
    )
  );

CREATE POLICY "User can unwave own wave"
  ON "PostWave" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PostWave"."userId"
    )
  );

-- ── 2. Post.waveCount column ────────────────────────────────────────
ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "waveCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: any pre-existing PostWave rows (unlikely on a fresh
-- migration but safe to handle) get counted into Post.waveCount.
UPDATE "Post" p
  SET "waveCount" = COALESCE(sub.cnt, 0)
  FROM (
    SELECT "postId", COUNT(*) AS cnt FROM "PostWave" GROUP BY "postId"
  ) sub
  WHERE p."id" = sub."postId";

-- ── 3. Triggers to keep Post.waveCount atomic ───────────────────────
CREATE OR REPLACE FUNCTION public.post_wave_count_inc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE "Post" SET "waveCount" = "waveCount" + 1 WHERE "id" = NEW."postId";
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_wave_count_dec()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE "Post" SET "waveCount" = GREATEST("waveCount" - 1, 0) WHERE "id" = OLD."postId";
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "PostWave_inc" ON "PostWave";
CREATE TRIGGER "PostWave_inc"
  AFTER INSERT ON "PostWave"
  FOR EACH ROW EXECUTE FUNCTION public.post_wave_count_inc();

DROP TRIGGER IF EXISTS "PostWave_dec" ON "PostWave";
CREATE TRIGGER "PostWave_dec"
  AFTER DELETE ON "PostWave"
  FOR EACH ROW EXECUTE FUNCTION public.post_wave_count_dec();

NOTIFY pgrst, 'reload schema';
