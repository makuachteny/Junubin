// Haboba — Product Catalog
// Store-ready IDs compatible with App Store / Google Play

export const PRODUCT_IDS = {
  // Subscriptions
  GOLD_MONTHLY: 'com.haboba.sub.gold.monthly',
  ROYAL_WEEKLY: 'com.haboba.sub.royal.weekly',
  ROYAL_MONTHLY: 'com.haboba.sub.royal.monthly',
  ROYAL_3MONTH: 'com.haboba.sub.royal.3month',
  ROYAL_6MONTH: 'com.haboba.sub.royal.6month',
  CROWN_MONTHLY: 'com.haboba.sub.crown.monthly',

  // Consumables — Spotlights
  SPOTLIGHT_1: 'com.haboba.spotlight.1',
  SPOTLIGHT_5: 'com.haboba.spotlight.5',
  SPOTLIGHT_10: 'com.haboba.spotlight.10',

  // Consumables — Super Likes
  SUPERLIKE_5: 'com.haboba.superlike.5',
  SUPERLIKE_15: 'com.haboba.superlike.15',
  SUPERLIKE_30: 'com.haboba.superlike.30',
};

// Tier hierarchy for comparison (higher = more premium)
export const TIER_RANK = {
  free: 0,
  gold: 1,
  royal: 2,
  crown: 3,
};

// Full product catalog with metadata
export const PRODUCTS = {
  // Gold
  [PRODUCT_IDS.GOLD_MONTHLY]: {
    id: PRODUCT_IDS.GOLD_MONTHLY,
    type: 'subscription',
    tier: 'gold',
    label: 'Gold Monthly',
    price: '$9.99',
    period: 'month',
  },

  // Royal
  [PRODUCT_IDS.ROYAL_WEEKLY]: {
    id: PRODUCT_IDS.ROYAL_WEEKLY,
    type: 'subscription',
    tier: 'royal',
    label: 'Royal Weekly',
    price: '$21.99',
    period: 'week',
  },
  [PRODUCT_IDS.ROYAL_MONTHLY]: {
    id: PRODUCT_IDS.ROYAL_MONTHLY,
    type: 'subscription',
    tier: 'royal',
    label: 'Royal Monthly',
    price: '$29.99',
    period: 'month',
  },
  [PRODUCT_IDS.ROYAL_3MONTH]: {
    id: PRODUCT_IDS.ROYAL_3MONTH,
    type: 'subscription',
    tier: 'royal',
    label: 'Royal 3 Months',
    price: '$59.99',
    period: '3 months',
  },
  [PRODUCT_IDS.ROYAL_6MONTH]: {
    id: PRODUCT_IDS.ROYAL_6MONTH,
    type: 'subscription',
    tier: 'royal',
    label: 'Royal 6 Months',
    price: '$71.99',
    period: '6 months',
  },

  // Crown
  [PRODUCT_IDS.CROWN_MONTHLY]: {
    id: PRODUCT_IDS.CROWN_MONTHLY,
    type: 'subscription',
    tier: 'crown',
    label: 'Crown Monthly',
    price: '$29.99',
    period: 'month',
  },

  // Spotlights
  [PRODUCT_IDS.SPOTLIGHT_1]: {
    id: PRODUCT_IDS.SPOTLIGHT_1,
    type: 'consumable',
    category: 'spotlight',
    quantity: 1,
    price: '$5.99',
  },
  [PRODUCT_IDS.SPOTLIGHT_5]: {
    id: PRODUCT_IDS.SPOTLIGHT_5,
    type: 'consumable',
    category: 'spotlight',
    quantity: 5,
    price: '$19.99',
  },
  [PRODUCT_IDS.SPOTLIGHT_10]: {
    id: PRODUCT_IDS.SPOTLIGHT_10,
    type: 'consumable',
    category: 'spotlight',
    quantity: 10,
    price: '$29.99',
  },

  // Super Likes
  [PRODUCT_IDS.SUPERLIKE_5]: {
    id: PRODUCT_IDS.SUPERLIKE_5,
    type: 'consumable',
    category: 'superlike',
    quantity: 5,
    price: '$7.99',
  },
  [PRODUCT_IDS.SUPERLIKE_15]: {
    id: PRODUCT_IDS.SUPERLIKE_15,
    type: 'consumable',
    category: 'superlike',
    quantity: 15,
    price: '$17.99',
  },
  [PRODUCT_IDS.SUPERLIKE_30]: {
    id: PRODUCT_IDS.SUPERLIKE_30,
    type: 'consumable',
    category: 'superlike',
    quantity: 30,
    price: '$29.99',
  },
};
