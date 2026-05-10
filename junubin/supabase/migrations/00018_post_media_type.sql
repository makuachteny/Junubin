-- 00018 — Post media type + aspect ratio.
--
-- The community feed previously assumed every Post had at most a
-- single image at a fixed aspect ratio. The new Instagram-style
-- PostCard wants to:
--
--   1. Accept videos (Post.imageUrl can hold a video URL too — the
--      mediaType column tells the renderer which to use).
--   2. Render the media at the post's natural aspect ratio (square,
--      portrait, landscape) instead of squashing everything into a
--      fixed 0.62-of-width band. We persist the ratio at upload time
--      so the renderer doesn't have to wait on Image.getSize round
--      trips before laying out.
--
-- Both columns are nullable and have safe defaults so older posts
-- (with just imageUrl set) keep rendering as 1:1 images. Storage
-- policies for the existing `posts` bucket already permit any file
-- type, so videos go through the same upload path.

ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "mediaType" TEXT
    CHECK ("mediaType" IS NULL OR "mediaType" IN ('image', 'video'));

ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "aspectRatio" REAL;

-- Backfill: any existing post with imageUrl is an image. Posts
-- without media stay null.
UPDATE "Post"
   SET "mediaType" = 'image'
 WHERE "mediaType" IS NULL
   AND "imageUrl" IS NOT NULL;

-- aspectRatio is left null on backfill — the renderer falls back to
-- 1:1 (square) when null, which matches the legacy fixed-band layout
-- closely enough that no in-place re-measurement is needed.
