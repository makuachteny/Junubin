-- ============================================================================
-- JuNubin Schema Migration: Combined from Prisma migrations, adapted for Supabase
-- ============================================================================

-- Enums
CREATE TYPE "Gender" AS ENUM ('man', 'woman', 'non_binary', 'other');
CREATE TYPE "SwipeType" AS ENUM ('like', 'pass', 'super_like');
CREATE TYPE "MatchStatus" AS ENUM ('active', 'blocked', 'unmatched');
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'audio');

-- ============================================================================
-- User (linked to Supabase Auth via auth_id)
-- ============================================================================
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "auth_id" UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,  -- nullable: Supabase handles auth
    "displayName" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "countryCode" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_countryCode_city_idx" ON "User"("countryCode", "city");
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");
CREATE INDEX "User_auth_id_idx" ON "User"("auth_id");

-- ============================================================================
-- Profile (1:1 with User)
-- ============================================================================
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "lookingFor" TEXT,
    "minPreferredAge" INTEGER DEFAULT 18,
    "maxPreferredAge" INTEGER DEFAULT 99,
    "maxDistanceKm" INTEGER DEFAULT 100,
    "showMe" BOOLEAN NOT NULL DEFAULT true,
    "relationshipType" TEXT,
    "datingIntentions" TEXT,
    "ethnicity" TEXT,
    "heightCm" INTEGER,
    "pronouns" TEXT,
    "education" TEXT,
    "children" TEXT,
    "job" TEXT,
    "school" TEXT,
    "interests" JSONB,
    "stickers" JSONB,
    "promptQuestion" TEXT,
    "promptAnswer" TEXT,
    "sexuality" TEXT,
    "lookingForGender" TEXT,
    "currentlyInto" JSONB,
    "currentlyIntoSetAt" TIMESTAMP(3),
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- ============================================================================
-- Photo
-- ============================================================================
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,  -- Supabase Storage path (replaces cloudinaryPublicId)
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Photo_userId_sortOrder_idx" ON "Photo"("userId", "sortOrder");

-- ============================================================================
-- Swipe
-- ============================================================================
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "type" "SwipeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Swipe_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Swipe_toUserId_type_createdAt_idx" ON "Swipe"("toUserId", "type", "createdAt");
CREATE UNIQUE INDEX "Swipe_fromUserId_toUserId_key" ON "Swipe"("fromUserId", "toUserId");

-- ============================================================================
-- Match
-- ============================================================================
CREATE TABLE "Match" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "pairKey" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Match_pairKey_key" ON "Match"("pairKey");
CREATE INDEX "Match_userAId_status_idx" ON "Match"("userAId", "status");
CREATE INDEX "Match_userBId_status_idx" ON "Match"("userBId", "status");

-- ============================================================================
-- Conversation (1:1 with Match)
-- ============================================================================
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "matchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_matchId_key" ON "Conversation"("matchId");

-- ============================================================================
-- ConversationMember
-- ============================================================================
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationMember_userId_joinedAt_idx" ON "ConversationMember"("userId", "joinedAt");
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- ============================================================================
-- Message
-- ============================================================================
CREATE TABLE "Message" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- ============================================================================
-- UserPreferenceVector (behavioral learning)
-- ============================================================================
CREATE TABLE "UserPreferenceVector" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "ethnicityWeights" JSONB,
    "interestWeights" JSONB,
    "preferredAgeMin" INTEGER,
    "preferredAgeMax" INTEGER,
    "preferredHeightMin" INTEGER,
    "preferredHeightMax" INTEGER,
    "stickerWeights" JSONB,
    "intentionWeights" JSONB,
    "swipesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPreferenceVector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreferenceVector_userId_key" ON "UserPreferenceVector"("userId");

-- ============================================================================
-- UserPopularity (Elo + community metrics)
-- ============================================================================
CREATE TABLE "UserPopularity" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "eloScore" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "totalLikesReceived" INTEGER NOT NULL DEFAULT 0,
    "totalPassesReceived" INTEGER NOT NULL DEFAULT 0,
    "totalSuperLikes" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "likeRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPopularity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPopularity_userId_key" ON "UserPopularity"("userId");

-- ============================================================================
-- Foreign Keys
-- ============================================================================
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Photo" ADD CONSTRAINT "Photo_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_toUserId_fkey"
    FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match" ADD CONSTRAINT "Match_userAId_fkey"
    FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match" ADD CONSTRAINT "Match_userBId_fkey"
    FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPreferenceVector" ADD CONSTRAINT "UserPreferenceVector_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPopularity" ADD CONSTRAINT "UserPopularity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Storage bucket for photos
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);
