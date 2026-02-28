// Haboba — Entitlement Helpers
// Pure functions for checking subscription access outside of React components

import { TIER_RANK } from './products';

export function hasTierAccess(currentTier, requiredTier) {
  return (TIER_RANK[currentTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

export function canSeeWhoLikesYou(tier) {
  return hasTierAccess(tier, 'royal');
}

export function hasUnlimitedLikes(tier) {
  return hasTierAccess(tier, 'gold');
}

export function canUseAdvancedFilters(tier) {
  return hasTierAccess(tier, 'crown');
}

export function canUseIncognito(tier) {
  return hasTierAccess(tier, 'crown');
}

export function hasUnlimitedRewinds(tier) {
  return hasTierAccess(tier, 'gold');
}

export function isSubscribed(tier) {
  return tier !== 'free';
}
