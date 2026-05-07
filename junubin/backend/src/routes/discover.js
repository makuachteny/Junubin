import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { rankCandidates } from '../utils/scoring.js';
import { getOrComputeVector } from '../utils/preferenceVector.js';
import { getPopularityBatch, getCollaborativeBoosts } from '../utils/popularity.js';
import { matchingConfig } from '../config/matching.js';
import { emitAnalyticsEvent } from '../utils/analytics.js';

const router = Router();

const querySchema = z.object({
  minAge: z.coerce.number().int().min(18).max(99).optional(),
  maxAge: z.coerce.number().int().min(18).max(99).optional(),
  ethnicity: z.string().max(120).optional(),
  minHeightCm: z.coerce.number().int().min(100).max(250).optional(),
  maxHeightCm: z.coerce.number().int().min(100).max(250).optional(),
  datingIntentions: z.string().max(120).optional(),
  gender: z.enum(['man', 'woman', 'non_binary', 'other']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().max(50).optional(),
  mode: z.enum(['dating', 'social']).optional().default('dating'),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = querySchema.parse(req.query);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const minDob = query.maxAge
      ? new Date(now.getFullYear() - query.maxAge - 1, now.getMonth(), now.getDate())
      : undefined;
    const maxDob = query.minAge
      ? new Date(now.getFullYear() - query.minAge, now.getMonth(), now.getDate())
      : undefined;

    // Fetch current user's profile + interests for scoring
    const currentUserProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    const swiped = await prisma.swipe.findMany({
      where: { fromUserId: req.user.id },
      select: { toUserId: true },
    });
    const excludedIds = swiped.length > 0 ? swiped.map((s) => s.toUserId) : [];

    const profileFilter = {};
    if (query.ethnicity) profileFilter.ethnicity = query.ethnicity;
    if (query.minHeightCm || query.maxHeightCm) {
      profileFilter.heightCm = {};
      if (query.minHeightCm) profileFilter.heightCm.gte = query.minHeightCm;
      if (query.maxHeightCm) profileFilter.heightCm.lte = query.maxHeightCm;
    }
    if (query.datingIntentions) profileFilter.datingIntentions = query.datingIntentions;

    // Social mode: relax gender filters, prefer friendship-oriented profiles
    const isSocial = query.mode === 'social';
    if (isSocial) {
      profileFilter.lookingFor = { contains: 'friend', mode: 'insensitive' };
    }

    // Fetch limit * 3 candidates for scoring, then trim
    const fetchLimit = query.limit * 3;

    const profiles = await prisma.user.findMany({
      where: {
        id: { not: req.user.id, notIn: excludedIds },
        isActive: true,
        lastActiveAt: { gte: thirtyDaysAgo },
        profile: { showMe: true, ...profileFilter },
        // Social mode: don't filter by gender (friendship isn't gendered)
        ...(!isSocial && query.gender ? { gender: query.gender } : {}),
        ...(minDob || maxDob
          ? {
              dateOfBirth: {
                ...(minDob ? { gte: minDob } : {}),
                ...(maxDob ? { lte: maxDob } : {}),
              },
            }
          : {}),
      },
      take: fetchLimit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        profile: true,
        photos: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    // Score and rank candidates
    const hasMore = profiles.length > fetchLimit;
    const pool = hasMore ? profiles.slice(0, fetchLimit) : profiles;

    // Phase 3: Behavioral learning — fetch preference vector
    const preferenceVector = await getOrComputeVector(req.user.id);

    // Phase 4: Community patterns — batch-fetch popularity + collaborative boosts
    const candidateIds = pool.map((c) => c.id);
    const popularityMap = await getPopularityBatch(candidateIds);
    const collaborativeBoosts = preferenceVector?.swipesAnalyzed >= 30
      ? await getCollaborativeBoosts(req.user.id, candidateIds)
      : {};

    const rankedResult = rankCandidates(pool, currentUserProfile, query.limit, matchingConfig.windowSize, {
      preferenceVector,
      popularityMap,
      collaborativeBoosts,
      exploreRate: matchingConfig.exploreRate,
      includeScores: matchingConfig.analyticsEnabled,
    });
    const ranked = matchingConfig.analyticsEnabled
      ? rankedResult.map((item) => item.candidate)
      : rankedResult;

    if (
      matchingConfig.analyticsEnabled &&
      Math.random() < matchingConfig.analyticsSampleRate
    ) {
      const top = rankedResult
        .slice(0, matchingConfig.analyticsTopK)
        .map((item) => ({
          candidateId: item.candidate.id,
          score: item.score,
          breakdown: item.breakdown,
        }));

      emitAnalyticsEvent('discover_ranked', {
        userId: req.user.id,
        mode: query.mode,
        poolSize: pool.length,
        returnedCount: ranked.length,
        top,
      });
    }

    const nextCursor = hasMore ? pool[pool.length - 1].id : null;

    res.json({ profiles: ranked, nextCursor });
  })
);

export default router;
