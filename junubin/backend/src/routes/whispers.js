import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const whisperSchema = z.object({
  toUserId: z.string().min(1),
  body: z.string().min(1).max(280),
});

const COOLDOWN_SECONDS = 60;

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = whisperSchema.parse(req.body);
    if (payload.toUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot whisper yourself' });
    }

    // Check target user exists
    const target = await prisma.user.findUnique({
      where: { id: payload.toUserId },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Block checks (either direction)
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.user.id, blockedId: payload.toUserId },
          { blockerId: payload.toUserId, blockedId: req.user.id },
        ],
      },
      select: { id: true },
    });
    if (blocked) return res.status(403).json({ error: 'Blocked' });

    // Cooldown check
    const since = new Date(Date.now() - COOLDOWN_SECONDS * 1000);
    const recent = await prisma.whisper.findFirst({
      where: { fromUserId: req.user.id, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) {
      return res.status(429).json({ error: 'cooldown', message: 'Please wait before sending another whisper.' });
    }

    const whisper = await prisma.whisper.create({
      data: {
        fromUserId: req.user.id,
        toUserId: payload.toUserId,
        body: payload.body.trim(),
      },
    });

    res.status(201).json({ ok: true, whisperId: whisper.id });
  })
);

export default router;
