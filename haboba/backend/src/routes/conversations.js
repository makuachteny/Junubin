import { Router } from 'express';
import { MessageType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const stripHtml = (str) => str.replace(/<[^>]*>/g, '').trim();

const createMessageSchema = z.object({
  body: z.string().min(1).max(4000).transform(stripHtml),
  type: z.nativeEnum(MessageType).optional().default(MessageType.text),
});

const ensureMember = async (conversationId, userId) => {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  return !!member;
};

router.get(
  '/:conversationId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const isMember = await ensureMember(conversationId, req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden' });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    res.json({ messages });
  })
);

router.post(
  '/:conversationId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const payload = createMessageSchema.parse(req.body);
    const isMember = await ensureMember(conversationId, req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden' });

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        body: payload.body,
        type: payload.type,
      },
      include: { sender: { select: { id: true, displayName: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({ message });
  })
);

export default router;
