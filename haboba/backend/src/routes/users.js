import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  bio: z.string().max(600).optional(),
  lookingFor: z.string().max(120).optional(),
  minPreferredAge: z.number().int().min(18).max(99).optional(),
  maxPreferredAge: z.number().int().min(18).max(99).optional(),
  maxDistanceKm: z.number().int().min(1).max(500).optional(),
  showMe: z.boolean().optional(),
  countryCode: z.string().max(8).optional(),
  city: z.string().max(120).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['man', 'woman', 'non_binary', 'other']).optional(),
  ethnicity: z.string().max(120).optional(),
  heightCm: z.number().int().min(100).max(250).optional(),
  pronouns: z.string().max(30).optional(),
  education: z.string().max(120).optional(),
  children: z.string().max(120).optional(),
  job: z.string().max(120).optional(),
  school: z.string().max(200).optional(),
  interests: z.array(z.string()).optional(),
  stickers: z.array(z.object({ emoji: z.string(), label: z.string() })).optional(),
  promptQuestion: z.string().max(200).optional(),
  promptAnswer: z.string().max(500).optional(),
  sexuality: z.string().max(60).optional(),
  lookingForGender: z.string().max(60).optional(),
  datingIntentions: z.string().max(120).optional(),
  relationshipType: z.string().max(120).optional(),
  profileComplete: z.boolean().optional(),
});

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = updateProfileSchema.parse(req.body);

    // Separate user-level fields from profile-level fields
    const profileFields = [
      'bio', 'lookingFor', 'minPreferredAge', 'maxPreferredAge', 'maxDistanceKm',
      'showMe', 'ethnicity', 'heightCm', 'pronouns', 'education', 'children',
      'job', 'school', 'interests', 'stickers', 'promptQuestion', 'promptAnswer',
      'sexuality', 'lookingForGender', 'datingIntentions', 'relationshipType', 'profileComplete',
    ];
    const profileUpdate = {};
    const profileCreate = {};
    for (const key of profileFields) {
      if (payload[key] != null) {
        profileUpdate[key] = payload[key];
        profileCreate[key] = payload[key];
      }
    }
    if (!('showMe' in profileCreate)) profileCreate.showMe = true;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(payload.displayName ? { displayName: payload.displayName } : {}),
        ...(payload.countryCode ? { countryCode: payload.countryCode } : {}),
        ...(payload.city ? { city: payload.city } : {}),
        ...(payload.latitude != null ? { latitude: payload.latitude } : {}),
        ...(payload.longitude != null ? { longitude: payload.longitude } : {}),
        ...(payload.dateOfBirth ? { dateOfBirth: new Date(payload.dateOfBirth) } : {}),
        ...(payload.gender ? { gender: payload.gender } : {}),
        profile: {
          upsert: {
            update: profileUpdate,
            create: profileCreate,
          },
        },
      },
      include: { profile: true, photos: { orderBy: { sortOrder: 'asc' } } },
    });

    res.json({ user });
  })
);

export default router;
