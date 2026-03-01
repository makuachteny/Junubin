import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const CURATED_SUGGESTIONS = [
  'South Sudanese music',
  'Juba nightlife',
  'Wrestling',
  'Traditional cooking',
  'Asida nights',
  'Diaspora meetups',
  'Cultural fashion',
  'Gospel music',
  'Afrobeats',
  'Sunday church',
  'Nile sunsets',
  'Community events',
  'Sudanese tea',
  'Family cookout',
  'Junub pride',
];

/**
 * GET / — returns trending "Currently Into" items.
 * Aggregates from active users + merges curated South Sudanese suggestions.
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch currentlyInto arrays from recently active users
    const profiles = await prisma.profile.findMany({
      where: {
        user: { lastActiveAt: { gte: sevenDaysAgo }, isActive: true },
        currentlyInto: { not: null },
      },
      select: { currentlyInto: true },
    });

    // Count frequency of each item
    const freq = {};
    for (const p of profiles) {
      const items = Array.isArray(p.currentlyInto) ? p.currentlyInto : [];
      for (const item of items) {
        if (typeof item === 'string' && item.trim()) {
          const key = item.trim();
          freq[key] = (freq[key] || 0) + 1;
        }
      }
    }

    // Sort by frequency descending, take top 20
    const trending = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([item, count]) => ({ item, count }));

    // Merge curated suggestions (add any not already trending)
    const trendingItems = new Set(trending.map((t) => t.item.toLowerCase()));
    const suggestions = CURATED_SUGGESTIONS.filter(
      (s) => !trendingItems.has(s.toLowerCase())
    );

    res.json({ trending, suggestions });
  })
);

export default router;
