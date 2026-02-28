import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const querySchema = z.object({
  minAge: z.coerce.number().int().min(18).max(99).optional(),
  maxAge: z.coerce.number().int().min(18).max(99).optional(),
  ethnicity: z.string().optional(),
  minHeightCm: z.coerce.number().int().optional(),
  maxHeightCm: z.coerce.number().int().optional(),
  datingIntentions: z.string().optional(),
  gender: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = querySchema.parse(req.query);
    const now = new Date();
    const minDob = query.maxAge
      ? new Date(now.getFullYear() - query.maxAge - 1, now.getMonth(), now.getDate())
      : undefined;
    const maxDob = query.minAge
      ? new Date(now.getFullYear() - query.minAge, now.getMonth(), now.getDate())
      : undefined;

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

    const profiles = await prisma.user.findMany({
      where: {
        id: { not: req.user.id, notIn: excludedIds },
        isActive: true,
        profile: { showMe: true, ...profileFilter },
        ...(query.gender ? { gender: query.gender } : {}),
        ...(minDob || maxDob
          ? {
              dateOfBirth: {
                ...(minDob ? { gte: minDob } : {}),
                ...(maxDob ? { lte: maxDob } : {}),
              },
            }
          : {}),
      },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        profile: true,
        photos: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    const hasMore = profiles.length > query.limit;
    const results = hasMore ? profiles.slice(0, query.limit) : profiles;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    res.json({ profiles: results, nextCursor });
  })
);

export default router;
