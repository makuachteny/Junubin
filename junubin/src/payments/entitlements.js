// JuNubin — Entitlement Helpers
// Pure functions for checking subscription access outside of React components
// Tiers: free → plus (JuNubin+) → junub (premium)
//
// ── FREE-FOR-ALL FLAG ──────────────────────────────────────────────
// For the v1 TestFlight launch we ship with ALL features unlocked for
// every user regardless of tier. This pairs with the
// `PAYMENTS_ENABLED = false` gate in src/payments/comingSoon.js — no
// one can buy anything yet, so it would be hostile to lock the
// premium UX behind paywalls. Flip both flags simultaneously when
// payments go live.
//
// All entitlement checks below early-return `true` while this flag is
// on, so every screen's `hasTier(...)` / `canUse*(...)` evaluation
// resolves to "yes, you can use this." Daily like limits and
// consumable-balance gates are bypassed at their respective call
// sites (HomeScreen swipe, super-like / whisper handlers, etc.) —
// search the codebase for `ALL_FEATURES_FREE` to find them.

import { TIER_RANK } from './products';

export const ALL_FEATURES_FREE = false;

export function hasTierAccess(currentTier, requiredTier) {
  if (ALL_FEATURES_FREE) return true;
  return (TIER_RANK[currentTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

// JuNubin+ (plus) features
export function hasUnlimitedLikes(tier) {
  if (ALL_FEATURES_FREE) return true;
  return hasTierAccess(tier, 'plus');
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
