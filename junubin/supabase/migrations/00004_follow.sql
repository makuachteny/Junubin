-- ============================================================================
-- Follow System: Follow + Friend relationships
-- A "friend" = mutual follow (both users follow each other)
-- ============================================================================

-- Follow table
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- Prevent duplicate follows and self-follows
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- Foreign keys
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey"
    FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey"
    FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prevent self-follows at DB level
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_no_self_follow"
    CHECK ("followerId" != "followingId");

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE "Follow" ENABLE ROW LEVEL SECURITY;

-- Anyone can see follows (public social graph)
CREATE POLICY "Follow_select" ON "Follow"
    FOR SELECT USING (true);

-- Users can only create follows where they are the follower
CREATE POLICY "Follow_insert" ON "Follow"
    FOR INSERT WITH CHECK (
        "followerId" = (
            SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()
        )
    );

-- Users can only delete their own follows
CREATE POLICY "Follow_delete" ON "Follow"
    FOR DELETE USING (
        "followerId" = (
            SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()
        )
    );
