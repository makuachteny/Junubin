import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { makePairKey } from '../utils/pairKey.js';

const router = Router();

const blockSchema = z.object({
  userId: z.string().min(1),
});

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = blockSchema.parse(req.body);
    if (payload.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: payload.userId } },
      update: {},
      create: { blockerId: req.user.id, blockedId: payload.userId },
    });

    const pairKey = makePairKey(req.user.id, payload.userId);
    await prisma.match.updateMany({
      where: { pairKey },
      data: { status: 'blocked' },
    });

    res.status(201).json({ ok: true });
  })
);

router.delete(
  '/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    await prisma.block.deleteMany({
      where: { blockerId: req.user.id, blockedId: userId },
    });
    res.json({ ok: true });
  })
);

export default router;
