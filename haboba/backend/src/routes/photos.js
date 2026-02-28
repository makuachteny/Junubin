import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /v1/users/me/photos — upload a photo
router.post(
  '/',
  requireAuth,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const photoCount = await prisma.photo.count({ where: { userId: req.user.id } });
    if (photoCount >= 9) {
      return res.status(400).json({ error: 'Maximum 9 photos allowed' });
    }

    let url = '';
    let cloudinaryPublicId = null;

    try {
      const result = await uploadToCloudinary(req.file.buffer, `junubin/users/${req.user.id}`);
      url = result.url;
      cloudinaryPublicId = result.publicId;
    } catch {
      // If Cloudinary is not configured, store as base64 data URI (dev fallback)
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const photo = await prisma.photo.create({
      data: {
        userId: req.user.id,
        url,
        cloudinaryPublicId,
        sortOrder: photoCount,
        isPrimary: photoCount === 0,
      },
    });

    res.status(201).json({ photo });
  })
);

// DELETE /v1/users/me/photos/:id
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (photo.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(photo.cloudinaryPublicId);
      } catch {}
    }

    await prisma.photo.delete({ where: { id: photo.id } });

    // Re-order remaining photos using batch transaction
    const remaining = await prisma.photo.findMany({
      where: { userId: req.user.id },
      orderBy: { sortOrder: 'asc' },
    });
    if (remaining.length > 0) {
      await prisma.$transaction(
        remaining.map((p, i) =>
          prisma.photo.update({
            where: { id: p.id },
            data: { sortOrder: i, isPrimary: i === 0 },
          })
        )
      );
    }

    res.json({ ok: true });
  })
);

// PATCH /v1/users/me/photos/:id — reorder
const reorderSchema = z.object({
  sortOrder: z.number().int().min(0),
});

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { sortOrder } = reorderSchema.parse(req.body);
    const photo = await prisma.photo.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    await prisma.photo.update({
      where: { id: photo.id },
      data: { sortOrder, isPrimary: sortOrder === 0 },
    });

    res.json({ ok: true });
  })
);

export default router;
