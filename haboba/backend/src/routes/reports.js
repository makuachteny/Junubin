import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const reportSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(2).max(120),
  details: z.string().max(500).optional(),
});

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = reportSchema.parse(req.body);
    if (payload.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    await prisma.report.create({
      data: {
        reporterId: req.user.id,
        reportedId: payload.userId,
        reason: payload.reason,
        details: payload.details,
      },
    });

    res.status(201).json({ ok: true });
  })
);

export default router;
