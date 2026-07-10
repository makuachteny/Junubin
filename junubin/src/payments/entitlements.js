// JuNubin — Entitlement Helpers
// Pure functions for checking subscription access outside of React components
// Tiers: free → plus (JuNubin+) → junub (premium)
//
// ── FREE-FOR-ALL FLAG ──────────────────────────────────────────────
// When true every entitlement check short-circuits to `true`,
// daily-like ceilings are uncapped, and consumable balances are
// treated as infinite. Used during pre-monetization launches when we
// want the premium UX visible to everyone without a paywall.
//
// v1 launch posture: false — payments are live (see
// `PAYMENTS_ENABLED` in src/payments/comingSoon.js), so we gate
// premium features behind real subscription tiers and consumable
// balances. Daily like limits per tier come from
// `DAILY_LIKE_LIMIT_BY_TIER` below. Search for `ALL_FEATURES_FREE`
// to find every bypassed gate.

import { TIER_RANK } from './products';

export const ALL_FEATURES_FREE = false;

export function hasTierAccess(currentTier, requiredTier) {
  if (ALL_FEATURES_FREE) return true;
  return (TIER_RANK[currentTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

// Daily like ceiling per subscription tier. `null` == uncapped.
// Source of truth for the client; the Edge Function (swipe/index.ts)
// and SQL RPC (00037_per_tier_swipe_limit.sql) hold the same map on
// the server. Keep all three in sync — drift surfaces as either a UI
// lie or a surprise 429.
export const DAILY_LIKE_LIMIT_BY_TIER = Object.freeze({
  free: 20,
  plus: 50,
  junub: null,
});

export function getDailyLikeLimit(tier) {
  if (Object.prototype.hasOwnProperty.call(DAILY_LIKE_LIMIT_BY_TIER, tier)) {
    return DAILY_LIKE_LIMIT_BY_TIER[tier];
  }
  return DAILY_LIKE_LIMIT_BY_TIER.free;
}

// "Unlimited" means the tier has no daily ceiling — currently junub
// only. Plus moved off the unlimited bench in the per-tier reform
// (00037) and now has a 50/day cap, so the UI badge needs to render
// for it too.
export function hasUnlimitedLikes(tier) {
  if (ALL_FEATURES_FREE) return true;
  return getDailyLikeLimit(tier) === null;
}

export function hasUnlimitedRewinds(tier) {
  if (ALL_FEATURES_FREE) return true;
  return hasTierAccess(tier, 'plus');
}

export function canUseWhispers(tier) {
  if (ALL_FEATURES_FREE) return true;
  return hasTierAccess(tier, 'plus');
}

export function canUseAdvancedFilters(tier) {
  if (ALL_FEATURES_FREE) return true;
  return hasTierAccess(tier, 'plus');
}

// Junub features
export function canSeeWhoLikesYou(tier) {
  if (ALL_FEATURES_FREE) return true;
  return hasTierAccess(tier, 'junub');
}

export function canUseIncognito(tier) {
  if (ALL_FEATURES_FREE) return true;
  return hasTierAccess(tier, 'junub');
}

export function canUseDiasporaConnect(tier) {
  if (ALL_FEATURES_FREE) return true;
  return hasTierAccess(tier, 'junub');
}

export function isSubscribed(tier) {
  if (ALL_FEATURES_FREE) return true;
  // Explicit allowlist — `tier !== 'free'` is too loose, it returns
  // true for unauthenticated users (undefined) and for any unknown
  // string. Subscription state must be one of the defined paid tiers.
  return tier === 'plus' || tier === 'junub';
}
