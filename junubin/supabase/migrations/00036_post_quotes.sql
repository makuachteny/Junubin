-- 00036 — Quote-reposts (LinkedIn-style reshare with commentary).
--
-- A quote-repost is a NEW Post row that embeds an existing Post.
-- The repost gets its own engagement (likes/comments/waves), shows
-- up in the repostor's followers' feeds, AND increments the
-- original post's repostCount (via the existing 00017 PostRepost
-- trigger — see postService.createQuoteRepost which writes both
-- rows in one go).
--
-- Compare to the plain PostRepost row (00017):
--   PostRepost: invisible silent reshare; only the count changes.
--   Post.quotedPostId: visible quote-repost; full new card in feeds.

ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "quotedPostId" TEXT
    REFERENCES "Post"("id") ON DELETE SET NULL;

-- Index for back-reference lookups ("show me everyone who quoted
-- this post"). Partial — most posts have no quotedPostId so a full
-- index would be wasted space.
CREATE INDEX IF NOT EXISTS "Post_quotedPostId_idx"
  ON "Post" ("quotedPostId")
  WHERE "quotedPostId" IS NOT NULL;

-- Guard against quoting your own post in a loop (low-priority but
-- the check is free). Quoting yourself is allowed (people quote
-- their own old posts); the constraint just prevents quotedPostId
-- being equal to the row's own id, which is nonsensical.
ALTER TABLE "Post"
  DROP CONSTRAINT IF EXISTS "Post_quoted_not_self_chk";
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_quoted_not_self_chk"
  CHECK ("quotedPostId" IS NULL OR "quotedPostId" <> "id");

NOTIFY pgrst, 'reload schema';
