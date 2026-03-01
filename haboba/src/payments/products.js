// AnaJunubin — Product Catalog
// Two paid tiers: JuNubin+ (plus) and Junub (premium)
// No ads ever. Social mode always free. Community-first.

export const PRODUCT_IDS = {
  // ── JuNubin+ Subscriptions ──
  PLUS_MONTHLY: 'com.haboba.sub.plus.monthly',
  PLUS_6MONTH: 'com.haboba.sub.plus.6month',

  // ── Junub Subscriptions ──
  JUNUB_MONTHLY: 'com.haboba.sub.junub.monthly',
  JUNUB_6MONTH: 'com.haboba.sub.junub.6month',

  // ── Consumables — Spotlights ──
  SPOTLIGHT_1: 'com.haboba.spotlight.1',
  SPOTLIGHT_5: 'com.haboba.spotlight.5',
  SPOTLIGHT_10: 'com.haboba.spotlight.10',

  // ── Consumables — Super Likes ──
  SUPERLIKE_5: 'com.haboba.superlike.5',
  SUPERLIKE_15: 'com.haboba.superlike.15',
  SUPERLIKE_30: 'com.haboba.superlike.30',
};

// Tier hierarchy: free → plus → junub
export const TIER_RANK = {
  free: 0,
  plus: 1,
  junub: 2,
};

// Full product catalog with metadata
export const PRODUCTS = {
  // ── JuNubin+ ──
  [PRODUCT_IDS.PLUS_MONTHLY]: {
    id: PRODUCT_IDS.PLUS_MONTHLY,
    type: 'subscription',
    tier: 'plus',
    label: 'JuNubin+ Monthly',
    price: '$9.99',
    period: 'month',
    perMonth: '$9.99/mo',
  },
  [PRODUCT_IDS.PLUS_6MONTH]: {
    id: PRODUCT_IDS.PLUS_6MONTH,
    type: 'subscription',
    tier: 'plus',
    label: 'JuNubin+ 6 Months',
    price: '$39.99',
    period: '6 months',
    perMonth: '$6.66/mo',
  },

  // ── Junub ──
  [PRODUCT_IDS.JUNUB_MONTHLY]: {
    id: PRODUCT_IDS.JUNUB_MONTHLY,
    type: 'subscription',
    tier: 'junub',
    label: 'Junub Monthly',
    price: '$19.99',
    period: 'month',
    perMonth: '$19.99/mo',
  },
  [PRODUCT_IDS.JUNUB_6MONTH]: {
    id: PRODUCT_IDS.JUNUB_6MONTH,
    type: 'subscription',
    tier: 'junub',
    label: 'Junub 6 Months',
    price: '$79.99',
    period: '6 months',
    perMonth: '$13.33/mo',
  },

  // ── Spotlights ──
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

  // ── Super Likes ──
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
