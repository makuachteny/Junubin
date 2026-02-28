import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const matches = await prisma.match.findMany({
      where: {
        status: 'active',
        OR: [{ userAId: req.user.id }, { userBId: req.user.id }],
      },
      include: {
        userA: {
          select: { id: true, displayName: true, isVerified: true, photos: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        },
        userB: {
          select: { id: true, displayName: true, isVerified: true, photos: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        },
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, displayName: true } } },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const normalized = matches.map((match) => {
      const otherUser = match.userAId === req.user.id ? match.userB : match.userA;
      const lastMessage = match.conversation?.messages?.[0] || null;
      return {
        id: match.id,
        conversationId: match.conversation?.id,
        user: otherUser,
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.displayName,
              createdAt: lastMessage.createdAt,
            }
          : null,
        createdAt: match.createdAt,
      };
    });

    res.json({ matches: normalized });
  })
);

export default router;
