/**
 * Community-level popularity tracking: Elo ratings, like ratios,
 * and collaborative filtering approximation.
 */

import { prisma } from '../db/prisma.js';

const ELO_K_FACTOR = 32;
const COLLAB_MIN_SWIPES = 30;
const COLLAB_MIN_OVERLAP = 3;

// ── Elo updates ─────────────────────────────────────────────────────────────

/**
 * Calculate expected score for player A against player B.
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update Elo ratings after a swipe event.
 * Like/super_like = positive outcome for target. Pass = negative.
 * Also increments like/pass/super_like counters.
 */
export async function updateEloOnSwipe(fromUserId, toUserId, swipeType) {
  // Ensure both users have popularity records
  const [fromPop, toPop] = await Promise.all([
    prisma.userPopularity.upsert({
      where: { userId: fromUserId },
      update: {},
      create: { userId: fromUserId },
    }),
    prisma.userPopularity.upsert({
      where: { userId: toUserId },
      update: {},
      create: { userId: toUserId },
    }),
  ]);

  const isPositive = swipeType === 'like' || swipeType === 'super_like';

  // Elo calculation for the target user
  const expected = expectedScore(toPop.eloScore, fromPop.eloScore);
  const actual = isPositive ? 1 : 0;
  const newElo = toPop.eloScore + ELO_K_FACTOR * (actual - expected);

  // Update target's stats
  const updateData = {
    eloScore: newElo,
    lastComputedAt: new Date(),
  };

  if (swipeType === 'like') {
    updateData.totalLikesReceived = { increment: 1 };
  } else if (swipeType === 'super_like') {
    updateData.totalLikesReceived = { increment: 1 };
    updateData.totalSuperLikes = { increment: 1 };
  } else {
    updateData.totalPassesReceived = { increment: 1 };
  }

  await prisma.userPopularity.update({
    where: { userId: toUserId },
    data: updateData,
  });

  // Recompute likeRatio
  const updated = await prisma.userPopularity.findUnique({ where: { userId: toUserId } });
  if (updated) {
    const totalReactions = updated.totalLikesReceived + updated.totalPassesReceived;
    if (totalReactions > 0) {
      await prisma.userPopularity.update({
        where: { userId: toUserId },
        data: { likeRatio: updated.totalLikesReceived / totalReactions },
      });
    }
  }
}

/**
 * Increment match count for both users when a match is created.
 */
export async function incrementMatchCount(userAId, userBId) {
  await Promise.all([
    prisma.userPopularity.upsert({
      where: { userId: userAId },
      update: { totalMatches: { increment: 1 } },
      create: { userId: userAId, totalMatches: 1 },
    }),
    prisma.userPopularity.upsert({
      where: { userId: userBId },
      update: { totalMatches: { increment: 1 } },
      create: { userId: userBId, totalMatches: 1 },
    }),
  ]);
}

// ── Batch popularity fetch ──────────────────────────────────────────────────

/**
 * Fetch popularity records for a batch of user IDs.
 * @param {string[]} userIds
 * @returns {{ [userId: string]: object }} Map of userId to popularity record
 */
export async function getPopularityBatch(userIds) {
  if (!userIds || userIds.length === 0) return {};

  const records = await prisma.userPopularity.findMany({
    where: { userId: { in: userIds } },
  });

  const map = {};
  for (const r of records) {
    map[r.userId] = r;
  }
  return map;
}

// ── Collaborative filtering approximation ───────────────────────────────────

/**
 * Find users who liked similar profiles, then boost candidates those users also liked.
 * @param {string} userId - Current user
 * @param {string[]} candidateIds - Candidate user IDs to score
 * @returns {{ [candidateId: string]: number }} Map of candidateId to boost score
 */
export async function getCollaborativeBoosts(userId, candidateIds) {
  if (!candidateIds || candidateIds.length === 0) return {};

  // Get current user's liked profile IDs
  const myLikes = await prisma.swipe.findMany({
    where: {
      fromUserId: userId,
      type: { in: ['like', 'super_like'] },
    },
    select: { toUserId: true },
  });

  if (myLikes.length < COLLAB_MIN_SWIPES) return {};

  const myLikedIds = myLikes.map((s) => s.toUserId);
  const myLikedSet = new Set(myLikedIds);

  // Find users who also liked at least COLLAB_MIN_OVERLAP of the same profiles
  // Query: swipes where toUserId is in myLikedIds, group by fromUserId, count >= threshold
  const similarUserSwipes = await prisma.swipe.groupBy({
    by: ['fromUserId'],
    where: {
      toUserId: { in: myLikedIds },
      type: { in: ['like', 'super_like'] },
      fromUserId: { not: userId },
    },
    _count: { toUserId: true },
    having: {
      toUserId: { _count: { gte: COLLAB_MIN_OVERLAP } },
    },
  });

  if (similarUserSwipes.length === 0) return {};

  const similarUserIds = similarUserSwipes.map((s) => s.fromUserId);

  // Find which candidates were liked by similar users
  const candidateSet = new Set(candidateIds);
  const boostSwipes = await prisma.swipe.findMany({
    where: {
      fromUserId: { in: similarUserIds },
      toUserId: { in: candidateIds },
      type: { in: ['like', 'super_like'] },
    },
    select: { fromUserId: true, toUserId: true },
  });

  // Check for matches between similar users and candidates for higher boost
  const matchPairs = new Set();
  if (boostSwipes.length > 0) {
    const boostCandIds = [...new Set(boostSwipes.map((s) => s.toUserId))];
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { userAId: { in: similarUserIds }, userBId: { in: boostCandIds } },
          { userAId: { in: boostCandIds }, userBId: { in: similarUserIds } },
        ],
        status: 'active',
      },
      select: { userAId: true, userBId: true },
    });
    for (const m of matches) {
      matchPairs.add(`${m.userAId}-${m.userBId}`);
      matchPairs.add(`${m.userBId}-${m.userAId}`);
    }
  }

  // Compute boost scores per candidate
  const boosts = {};
  const likeCounts = {};

  for (const s of boostSwipes) {
    if (!candidateSet.has(s.toUserId)) continue;
    likeCounts[s.toUserId] = (likeCounts[s.toUserId] || 0) + 1;
  }

  for (const [candId, count] of Object.entries(likeCounts)) {
    // Check if any similar user matched with this candidate
    let hasMatch = false;
    for (const simUserId of similarUserIds) {
      if (matchPairs.has(`${simUserId}-${candId}`)) {
        hasMatch = true;
        break;
      }
    }

    if (hasMatch) {
      boosts[candId] = 20; // Matched by similar user
    } else if (count >= 2) {
      boosts[candId] = 15; // Liked by 2+ similar users
    }
  }

  return boosts;
}
