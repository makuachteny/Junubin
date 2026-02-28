import { Router } from 'express';
import { SwipeType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { makePairKey } from '../utils/pairKey.js';

const router = Router();

const swipeSchema = z.object({
  toUserId: z.string().min(1),
  type: z.nativeEnum(SwipeType),
});

// Allow server.js to inject the io instance
let io = null;
export function setSocketIO(ioInstance) {
  io = ioInstance;
}

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = swipeSchema.parse(req.body);
    if (payload.toUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot swipe yourself' });
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
