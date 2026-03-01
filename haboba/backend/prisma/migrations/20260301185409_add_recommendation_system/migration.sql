-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "currentlyInto" JSONB,
ADD COLUMN     "currentlyIntoSetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionTier" TEXT NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "UserPreferenceVector" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferenceVector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPopularity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eloScore" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "totalLikesReceived" INTEGER NOT NULL DEFAULT 0,
    "totalPassesReceived" INTEGER NOT NULL DEFAULT 0,
    "totalSuperLikes" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "likeRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPopularity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferenceVector_userId_key" ON "UserPreferenceVector"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPopularity_userId_key" ON "UserPopularity"("userId");

-- AddForeignKey
ALTER TABLE "UserPreferenceVector" ADD CONSTRAINT "UserPreferenceVector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPopularity" ADD CONSTRAINT "UserPopularity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
