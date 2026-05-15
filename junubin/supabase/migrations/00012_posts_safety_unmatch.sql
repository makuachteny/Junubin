-- 00012 — Posts + supporting bits.
--
-- Bundles three deployment fixes:
--
--   1. `Post` table — Community feed posts. Up to now the feed was 100%
--      mock because there was no schema; CreatePostScreen handed the
--      object back to CommunityScreen via navigation params, which got
--      lost on remount.
--   2. Unmatch helper — RPC that deletes the Match + Conversation +
--      members in one transaction so unmatch genuinely unmatches both
--      sides. Triggered from ChatScreen.
--   3. Spotlight bonus column on Profile — `spotlightedUntil` (TIMESTAMPTZ)
--      so the discover function can boost users who paid for spotlight.

-- ── 1. Post ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Post" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "content"     TEXT,
  "imageUrl"    TEXT,
  "imagePath"   TEXT,            -- storage path for cleanup on delete
  "location"    TEXT,
  "tags"        TEXT[] DEFAULT '{}',
  "cardTheme"   TEXT DEFAULT 'default',
  "signupLink"  TEXT,
  "signupTitle" TEXT,
  "likeCount"   INTEGER NOT NULL DEFAULT 0,
  "commentCount" INTEGER NOT NULL DEFAULT 0,
  "repostCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Post_user_idx"      ON "Post" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Post_created_idx"   ON "Post" ("createdAt" DESC);

ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts readable by all"
  ON "Post" FOR SELECT USING (TRUE);

CREATE POLICY "Author can insert own post"
  ON "Post" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Post"."userId"
    )
  );

CREATE POLICY "Author can update own post"
  ON "Post" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Post"."userId"
    )
  );

CREATE POLICY "Author can delete own post"
  ON "Post" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Post"."userId"
    )
  );

-- ── 2. Unmatch RPC ──────────────────────────────────────────────────
-- Cascade delete: removes the Match row, conversation, members,
-- messages. Either match participant can call. SECURITY DEFINER so
-- it can DELETE across the related tables without each one needing a
-- "deletable by member" RLS policy (which would also enable accidental
-- deletion via direct table access). Authorisation is checked inside
-- the function body.
CREATE OR REPLACE FUNCTION public.unmatch_user(other_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id    TEXT;
  match_id TEXT;
  conv_id  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO me_id FROM "User" WHERE auth_id = auth.uid();
  IF me_id IS NULL THEN
    RAISE EXCEPTION 'no user row';
  END IF;

  -- Match links via userAId/userBId in the canonical schema (00001).
  SELECT id
    INTO match_id
    FROM "Match"
    WHERE ("userAId" = me_id AND "userBId" = other_user_id)
       OR ("userAId" = other_user_id AND "userBId" = me_id)
    LIMIT 1;

  IF match_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Conversation back-references the Match via matchId, not the other way.
  SELECT id INTO conv_id FROM "Conversation" WHERE "matchId" = match_id;

  IF conv_id IS NOT NULL THEN
    DELETE FROM "Message"            WHERE "conversationId" = conv_id;
    DELETE FROM "ConversationMember" WHERE "conversationId" = conv_id;
    DELETE FROM "Conversation"       WHERE id = conv_id;
  END IF;

  DELETE FROM "Match" WHERE id = match_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unmatch_user(TEXT) TO authenticated;

-- ── 3. Spotlight column on Profile ──────────────────────────────────
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "spotlightedUntil" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Profile_spotlight_idx"
  ON "Profile" ("spotlightedUntil")
  WHERE "spotlightedUntil" IS NOT NULL;

-- Storage bucket for post images. Public-read because Community is a
-- public feed; per-user write via path-prefix gating.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('posts', 'posts', TRUE)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Posts img public read"  ON storage.objects;
DROP POLICY IF EXISTS "Posts img owner write"  ON storage.objects;
DROP POLICY IF EXISTS "Posts img owner update" ON storage.objects;
DROP POLICY IF EXISTS "Posts img owner delete" ON storage.objects;

CREATE POLICY "Posts img public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

CREATE POLICY "Posts img owner write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'posts'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Posts img owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'posts'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Posts img owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'posts'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );
