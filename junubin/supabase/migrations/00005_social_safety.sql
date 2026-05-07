-- Add MessageType.game
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'MessageType' AND e.enumlabel = 'game'
  ) THEN
    ALTER TYPE "MessageType" ADD VALUE 'game';
  END IF;
END $$;

-- Blocks table
CREATE TABLE IF NOT EXISTS "Block" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "Block_blockerId_idx" ON "Block"("blockerId");
CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId");

ALTER TABLE "Block"
  ADD CONSTRAINT "Block_blockerId_fkey"
  FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Block"
  ADD CONSTRAINT "Block_blockedId_fkey"
  FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Block" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block_select" ON "Block" FOR SELECT
  USING ("blockerId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid())
      OR "blockedId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()));
CREATE POLICY "Block_insert" ON "Block" FOR INSERT
  WITH CHECK ("blockerId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()));
CREATE POLICY "Block_delete" ON "Block" FOR DELETE
  USING ("blockerId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()));

-- Reports table
CREATE TABLE IF NOT EXISTS "Report" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "reporterId" TEXT NOT NULL,
  "reportedId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Report_reporterId_idx" ON "Report"("reporterId");
CREATE INDEX IF NOT EXISTS "Report_reportedId_idx" ON "Report"("reportedId");

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reportedId_fkey"
  FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Report_insert" ON "Report" FOR INSERT
  WITH CHECK ("reporterId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()));
CREATE POLICY "Report_select" ON "Report" FOR SELECT
  USING ("reporterId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()));

-- Whispers table
CREATE TABLE IF NOT EXISTS "Whisper" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Whisper_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Whisper_fromUserId_idx" ON "Whisper"("fromUserId");
CREATE INDEX IF NOT EXISTS "Whisper_toUserId_idx" ON "Whisper"("toUserId");

ALTER TABLE "Whisper"
  ADD CONSTRAINT "Whisper_fromUserId_fkey"
  FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Whisper"
  ADD CONSTRAINT "Whisper_toUserId_fkey"
  FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Whisper" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Whisper_select" ON "Whisper" FOR SELECT
  USING ("fromUserId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid())
      OR "toUserId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()));
CREATE POLICY "Whisper_insert" ON "Whisper" FOR INSERT
  WITH CHECK ("fromUserId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid()));

-- Game sessions table
CREATE TABLE IF NOT EXISTS "GameSession" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "conversationId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameSession_conversationId_gameId_key" ON "GameSession"("conversationId", "gameId");
CREATE INDEX IF NOT EXISTS "GameSession_conversationId_idx" ON "GameSession"("conversationId");

ALTER TABLE "GameSession"
  ADD CONSTRAINT "GameSession_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GameSession_select" ON "GameSession" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ConversationMember" cm
      WHERE cm."conversationId" = "GameSession"."conversationId"
        AND cm."userId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid())
    )
  );
CREATE POLICY "GameSession_upsert" ON "GameSession" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ConversationMember" cm
      WHERE cm."conversationId" = "GameSession"."conversationId"
        AND cm."userId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ConversationMember" cm
      WHERE cm."conversationId" = "GameSession"."conversationId"
        AND cm."userId" = (SELECT "id" FROM "User" WHERE "auth_id" = auth.uid())
    )
  );
