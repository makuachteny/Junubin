import { Router } from 'express';
import { SwipeType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { makePairKey } from '../utils/pairKey.js';
import { computePreferenceVectorIfStale } from '../utils/preferenceVector.js';
import { updateEloOnSwipe, incrementMatchCount } from '../utils/popularity.js';

const router = Router();

const FREE_DAILY_LIKE_LIMIT = 25;

const swipeSchema = z.object({
  toUserId: z.string().min(1),
  type: z.nativeEnum(SwipeType),
});

// Allow server.js to inject the io instance
let io = null;
export function setSocketIO(ioInstance) {
  io = ioInstance;
}

/**
 * Count today's likes for a user.
 */
async function countTodayLikes(userId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.swipe.count({
    where: {
      fromUserId: userId,
      type: { in: [SwipeType.like, SwipeType.super_like] },
      createdAt: { gte: startOfDay },
    },
  });
}

// GET /daily-status — returns daily like usage for the current user
router.get(
  '/daily-status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { subscriptionTier: true },
    });

    const tier = user?.subscriptionTier || 'free';
    const unlimited = tier !== 'free';
    const used = await countTodayLikes(req.user.id);
    const limit = unlimited ? Infinity : FREE_DAILY_LIKE_LIMIT;
    const remaining = unlimited ? Infinity : Math.max(0, FREE_DAILY_LIKE_LIMIT - used);

    res.json({ used, limit, remaining });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = swipeSchema.parse(req.body);
    if (payload.toUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot swipe yourself' });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: payload.toUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Enforce daily like limit for free users
    if (payload.type === SwipeType.like || payload.type === SwipeType.super_like) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { subscriptionTier: true },
      });

      const tier = user?.subscriptionTier || 'free';
      if (tier === 'free') {
        const todayCount = await countTodayLikes(req.user.id);
        if (todayCount >= FREE_DAILY_LIKE_LIMIT) {
          return res.status(429).json({
            error: 'daily_limit',
            message: 'Daily like limit reached',
            used: todayCount,
            limit: FREE_DAILY_LIKE_LIMIT,
            remaining: 0,
          });
        }
      }
    }

    await prisma.swipe.upsert({
      where: { fromUserId_toUserId: { fromUserId: req.user.id, toUserId: payload.toUserId } },
      update: { type: payload.type },
      create: {
        fromUserId: req.user.id,
        toUserId: payload.toUserId,
        type: payload.type,
      },
    });

    // Fire-and-forget: update preference vector + Elo scores
    computePreferenceVectorIfStale(req.user.id).catch(() => {});
    updateEloOnSwipe(req.user.id, payload.toUserId, payload.type).catch(() => {});

    let match = null;
    if (payload.type === SwipeType.like || payload.type === SwipeType.super_like) {
      const reciprocal = await prisma.swipe.findUnique({
        where: { fromUserId_toUserId: { fromUserId: payload.toUserId, toUserId: req.user.id } },
      });

      if (reciprocal && (reciprocal.type === SwipeType.like || reciprocal.type === SwipeType.super_like)) {
        const pairKey = makePairKey(req.user.id, payload.toUserId);
        const userAId = [req.user.id, payload.toUserId].sort()[0];
        const userBId = [req.user.id, payload.toUserId].sort()[1];

        match = await prisma.match.upsert({
          where: { pairKey },
          update: {},
          create: {
            pairKey,
            userAId,
            userBId,
            conversation: {
              create: {
                members: {
                  create: [{ userId: req.user.id }, { userId: payload.toUserId }],
                },
              },
            },
          },
          include: {
            conversation: true,
            userA: { select: { id: true, displayName: true, photos: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
            userB: { select: { id: true, displayName: true, photos: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
          },
        });

        // Fire-and-forget: increment match count for both users
        incrementMatchCount(req.user.id, payload.toUserId).catch(() => {});

        // Emit MATCH_CREATED to both users via Socket.IO
        if (io && match) {
          const matchPayload = {
            matchId: match.id,
            conversationId: match.conversation?.id,
            userA: match.userA,
            userB: match.userB,
          };
          io.to(`user:${req.user.id}`).emit('MATCH_CREATED', matchPayload);
          io.to(`user:${payload.toUserId}`).emit('MATCH_CREATED', matchPayload);
        }
      }
    }

    res.status(201).json({ ok: true, match });
  })
);

// GET /received — users who liked the current user
router.get(
  '/received',
  requireAuth,
  asyncHandler(async (req, res) => {
    const swipes = await prisma.swipe.findMany({
      where: {
        toUserId: req.user.id,
        type: { in: [SwipeType.like, SwipeType.super_like] },
      },
      include: {
        fromUser: {
          select: {
            id: true,
            displayName: true,
            dateOfBirth: true,
            isVerified: true,
            city: true,
            photos: { orderBy: { sortOrder: 'asc' } },
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out users who the current user has already swiped on
    const mySwipes = await prisma.swipe.findMany({
      where: { fromUserId: req.user.id },
      select: { toUserId: true },
    });
    const swipedIds = new Set(mySwipes.map((s) => s.toUserId));

    const likes = swipes
      .filter((s) => !swipedIds.has(s.fromUserId))
      .map((s) => ({
        id: s.id,
        type: s.type,
        createdAt: s.createdAt,
        user: s.fromUser,
      }));

    res.json({ likes });
  })
);

export default router;
