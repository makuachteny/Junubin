/**
 * Preference vector computation from swipe history.
 * Learns implicit preferences from who users like vs pass.
 */

import { prisma } from '../db/prisma.js';

const MIN_SWIPES = 20;
const CACHE_HOURS = 6;
const STALE_SWIPE_THRESHOLD = 10;

/**
 * Compute a preference vector for a user based on their swipe history.
 * @param {string} userId
 * @returns {object|null} The upserted UserPreferenceVector record, or null if insufficient data
 */
export async function computePreferenceVector(userId) {
  // Fetch all swipes with profiles of swiped users
  const swipes = await prisma.swipe.findMany({
    where: { fromUserId: userId },
    include: {
      toUser: {
        include: { profile: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (swipes.length < MIN_SWIPES) return null;

  const liked = swipes.filter((s) => s.type === 'like' || s.type === 'super_like');
  const passed = swipes.filter((s) => s.type === 'pass');
  const total = swipes.length;

  // ── Ethnicity weights ──
  const ethnicityCounts = { liked: {}, passed: {} };
  for (const s of liked) {
    const eth = s.toUser?.profile?.ethnicity;
    if (eth) ethnicityCounts.liked[eth] = (ethnicityCounts.liked[eth] || 0) + 1;
  }
  for (const s of passed) {
    const eth = s.toUser?.profile?.ethnicity;
    if (eth) ethnicityCounts.passed[eth] = (ethnicityCounts.passed[eth] || 0) + 1;
  }
  const allEthnicities = new Set([...Object.keys(ethnicityCounts.liked), ...Object.keys(ethnicityCounts.passed)]);
  const ethnicityWeights = {};
  for (const eth of allEthnicities) {
    const likedCount = ethnicityCounts.liked[eth] || 0;
    const passedCount = ethnicityCounts.passed[eth] || 0;
    ethnicityWeights[eth] = Math.max(-1, Math.min(1, (likedCount - passedCount) / total));
  }

  // ── Interest weights ──
  const interestCounts = { liked: {}, passed: {} };
  for (const s of liked) {
    const interests = s.toUser?.profile?.interests;
    if (Array.isArray(interests)) {
      for (const i of interests) interestCounts.liked[i] = (interestCounts.liked[i] || 0) + 1;
    }
  }
  for (const s of passed) {
    const interests = s.toUser?.profile?.interests;
    if (Array.isArray(interests)) {
      for (const i of interests) interestCounts.passed[i] = (interestCounts.passed[i] || 0) + 1;
    }
  }
  const allInterests = new Set([...Object.keys(interestCounts.liked), ...Object.keys(interestCounts.passed)]);
  const interestWeights = {};
  for (const i of allInterests) {
    const likedCount = interestCounts.liked[i] || 0;
    const passedCount = interestCounts.passed[i] || 0;
    interestWeights[i] = Math.max(-1, Math.min(1, (likedCount - passedCount) / total));
  }

  // ── Age preferences (average of liked profiles) ──
  let preferredAgeMin = null;
  let preferredAgeMax = null;
  const likedAges = [];
  const now = new Date();
  for (const s of liked) {
    if (s.toUser?.dateOfBirth) {
      const dob = new Date(s.toUser.dateOfBirth);
      let age = now.getFullYear() - dob.getFullYear();
      if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
        age--;
      }
      likedAges.push(age);
    }
  }
  if (likedAges.length >= 5) {
    likedAges.sort((a, b) => a - b);
    // Use 10th and 90th percentile for range
    const p10 = likedAges[Math.floor(likedAges.length * 0.1)];
    const p90 = likedAges[Math.floor(likedAges.length * 0.9)];
    preferredAgeMin = p10;
    preferredAgeMax = p90;
  }

  // ── Height preferences ──
  let preferredHeightMin = null;
  let preferredHeightMax = null;
  const likedHeights = [];
  for (const s of liked) {
    const h = s.toUser?.profile?.heightCm;
    if (h) likedHeights.push(h);
  }
  if (likedHeights.length >= 5) {
    likedHeights.sort((a, b) => a - b);
    const p10 = likedHeights[Math.floor(likedHeights.length * 0.1)];
    const p90 = likedHeights[Math.floor(likedHeights.length * 0.9)];
    preferredHeightMin = p10;
    preferredHeightMax = p90;
  }

  // ── Sticker weights ──
  const stickerCounts = { liked: {}, passed: {} };
  for (const s of liked) {
    const stickers = s.toUser?.profile?.stickers;
    if (Array.isArray(stickers)) {
      for (const st of stickers) {
        const label = typeof st === 'string' ? st : st?.label || '';
        if (label) stickerCounts.liked[label] = (stickerCounts.liked[label] || 0) + 1;
      }
    }
  }
  for (const s of passed) {
    const stickers = s.toUser?.profile?.stickers;
    if (Array.isArray(stickers)) {
      for (const st of stickers) {
        const label = typeof st === 'string' ? st : st?.label || '';
        if (label) stickerCounts.passed[label] = (stickerCounts.passed[label] || 0) + 1;
      }
    }
  }
  const allStickers = new Set([...Object.keys(stickerCounts.liked), ...Object.keys(stickerCounts.passed)]);
  const stickerWeights = {};
  for (const st of allStickers) {
    const likedCount = stickerCounts.liked[st] || 0;
    const passedCount = stickerCounts.passed[st] || 0;
    stickerWeights[st] = Math.max(-1, Math.min(1, (likedCount - passedCount) / total));
  }

  // ── Intention weights ──
  const intentionCounts = { liked: {}, passed: {} };
  for (const s of liked) {
    const intent = s.toUser?.profile?.datingIntentions;
    if (intent) intentionCounts.liked[intent] = (intentionCounts.liked[intent] || 0) + 1;
  }
  for (const s of passed) {
    const intent = s.toUser?.profile?.datingIntentions;
    if (intent) intentionCounts.passed[intent] = (intentionCounts.passed[intent] || 0) + 1;
  }
  const allIntentions = new Set([...Object.keys(intentionCounts.liked), ...Object.keys(intentionCounts.passed)]);
  const intentionWeights = {};
  for (const intent of allIntentions) {
    const likedCount = intentionCounts.liked[intent] || 0;
    const passedCount = intentionCounts.passed[intent] || 0;
    intentionWeights[intent] = Math.max(-1, Math.min(1, (likedCount - passedCount) / total));
  }

  // Upsert into database
  const vector = await prisma.userPreferenceVector.upsert({
    where: { userId },
    update: {
      ethnicityWeights,
      interestWeights,
      preferredAgeMin,
      preferredAgeMax,
      preferredHeightMin,
      preferredHeightMax,
      stickerWeights,
      intentionWeights,
      swipesAnalyzed: total,
      lastComputedAt: new Date(),
    },
    create: {
      userId,
      ethnicityWeights,
      interestWeights,
      preferredAgeMin,
      preferredAgeMax,
      preferredHeightMin,
      preferredHeightMax,
      stickerWeights,
      intentionWeights,
      swipesAnalyzed: total,
    },
  });

  return vector;
}

/**
 * Get cached preference vector, or recompute if stale.
 * @param {string} userId
 * @returns {object|null}
 */
export async function getOrComputeVector(userId) {
  const existing = await prisma.userPreferenceVector.findUnique({
    where: { userId },
  });

  if (existing) {
    const hoursOld = (Date.now() - new Date(existing.lastComputedAt).getTime()) / (1000 * 60 * 60);

    if (hoursOld < CACHE_HOURS) {
      // Check if enough new swipes to warrant recomputation
      const totalSwipes = await prisma.swipe.count({ where: { fromUserId: userId } });
      const newSwipes = totalSwipes - existing.swipesAnalyzed;

      if (newSwipes < STALE_SWIPE_THRESHOLD) {
        return existing;
      }
    }
  }

  return computePreferenceVector(userId);
}

/**
 * Fire-and-forget: recompute vector if it's stale.
 * Called after each swipe.
 */
export async function computePreferenceVectorIfStale(userId) {
  const existing = await prisma.userPreferenceVector.findUnique({
    where: { userId },
  });

  if (!existing) {
    // Check if we have enough swipes to compute for the first time
    const count = await prisma.swipe.count({ where: { fromUserId: userId } });
    if (count >= MIN_SWIPES) {
      return computePreferenceVector(userId);
    }
    return null;
  }

  const totalSwipes = await prisma.swipe.count({ where: { fromUserId: userId } });
  const newSwipes = totalSwipes - existing.swipesAnalyzed;

  if (newSwipes >= STALE_SWIPE_THRESHOLD) {
    return computePreferenceVector(userId);
  }

  return existing;
}
