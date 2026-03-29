// JuNubin — Entitlement Helpers
// Pure functions for checking subscription access outside of React components
// Tiers: free → plus (JuNubin+) → junub (premium)

import { TIER_RANK } from './products';

export function hasTierAccess(currentTier, requiredTier) {
  return (TIER_RANK[currentTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

// JuNubin+ (plus) features
export function hasUnlimitedLikes(tier) {
  return hasTierAccess(tier, 'plus');
}

export function hasUnlimitedRewinds(tier) {
  return hasTierAccess(tier, 'plus');
}

export function canUseWhispers(tier) {
  return hasTierAccess(tier, 'plus');
}

// Junub features
export function canSeeWhoLikesYou(tier) {
  return hasTierAccess(tier, 'junub');
}

export function canUseAdvancedFilters(tier) {
  return hasTierAccess(tier, 'plus');
}

export function canUseIncognito(tier) {
  return hasTierAccess(tier, 'junub');
}

export function canUseDiasporaConnect(tier) {
  return hasTierAccess(tier, 'junub');
}

export function isSubscribed(tier) {
  return tier !== 'free';
}
