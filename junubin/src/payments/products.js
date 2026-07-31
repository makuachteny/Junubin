// JuNubin — Product Catalog
//
// ── JUNUBIN IS FREE ────────────────────────────────────────────────
// JuNubin is a South Sudanese social / community platform and it has
// no monetization. Nothing in this file is sold: there is no paywall,
// no upgrade prompt, and no locked feature. `SHOW_PAYMENTS_UI` is
// permanently false and `ALL_FEATURES_FREE` is permanently true (see
// comingSoon.js / entitlements.js).
//
// This catalog survives for two reasons only:
//   1. Real products exist under these identifiers in App Store
//      Connect, Google Play, Stripe and Flutterwave. Renaming or
//      deleting an id orphans anything already live and makes
//      historical receipts unresolvable.
//   2. SubscriptionContext and the payment services still import
//      PRODUCTS / TIER_RANK / tierFromEntitlements. Keeping the shape
//      intact avoids breaking imports while the app is free.
//
// Dating monetization is gone: Super Likes, spotlight/boost packs and
// coin packs are no longer part of the sellable catalog. Their ids are
// preserved in RETIRED_PRODUCT_IDS below.

// RevenueCat entitlement identifiers (configured in RevenueCat dashboard)
export const ENTITLEMENTS = {
  PLUS: 'plus',
  JUNUB: 'junub',
};

// RevenueCat offering identifier
export const OFFERING_ID = 'default';

export const PRODUCT_IDS = {
  // ── Subscription ids — not sold, kept resolvable ──
  // The store-side products still exist under these identifiers, so
  // the strings must not change. Nothing in the app offers them.
  PLUS_MONTHLY: 'com.junubin.sub.plus.monthly',
  PLUS_6MONTH: 'com.junubin.sub.plus.6month',

  JUNUB_MONTHLY: 'com.junubin.sub.junub.monthly',
  JUNUB_6MONTH: 'com.junubin.sub.junub.6month',
};

// Retired consumables. These were the dating monetization: Super Likes,
// profile spotlights/boosts, and coin packs. They are removed from the
// catalog and from every purchase surface in the app.
//
// The identifiers survive here — and only here — so support tooling and
// historical receipts can still resolve a purchase to a name, and so
// the live Stripe / Flutterwave rows (kept, marked deprecated, in
// supabase/functions/_shared/) stay traceable to something readable.
// Nothing may move these back into PRODUCT_IDS or PRODUCTS.
export const RETIRED_PRODUCT_IDS = Object.freeze({
  SUPERLIKE_5: 'com.junubin.superlike.5',
  SUPERLIKE_15: 'com.junubin.superlike.15',
  SUPERLIKE_30: 'com.junubin.superlike.30',
  SPOTLIGHT_1: 'com.junubin.spotlight.1',
  SPOTLIGHT_5: 'com.junubin.spotlight.5',
  SPOTLIGHT_10: 'com.junubin.spotlight.10',
  COINS_100: 'com.junubin.coins.100',
  COINS_500: 'com.junubin.coins.500',
  COINS_1200: 'com.junubin.coins.1200',
});

// Tier hierarchy: free → plus → junub
// Retained because tierFromEntitlements and hasTierAccess still read
// it. Since every entitlement check short-circuits to `true`, the
// ranking has no user-visible effect.
export const TIER_RANK = {
  free: 0,
  plus: 1,
  junub: 2,
};

// Map RevenueCat entitlements to our tier names. Still used when
// restoring a pre-existing subscription so a legacy subscriber isn't
// reported as `free` — it grants nothing extra, because everything is
// already free for everyone.
export function tierFromEntitlements(entitlements) {
  if (entitlements?.[ENTITLEMENTS.JUNUB]?.isActive) return 'junub';
  if (entitlements?.[ENTITLEMENTS.PLUS]?.isActive) return 'plus';
  return 'free';
}

// Metadata for the subscription ids above. Nothing renders these — no
// screen sells a plan — but SubscriptionContext looks products up by id
// when reconciling a restored purchase, so the map stays populated.
// Prices are the historical USD amounts, kept for receipt readability.
export const PRODUCTS = {
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
};
