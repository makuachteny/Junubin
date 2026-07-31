// JuNubin — Entitlement Helpers
//
// ── JUNUBIN IS FREE. THIS FILE GATES NOTHING. ─────────────────────
// The app has no monetization: no paywall, no upgrade prompt, no
// locked feature, no daily limit. `ALL_FEATURES_FREE` is permanently
// true — it is not a launch toggle and there is no planned flip.
//
// Every function below is a shim that returns `true` (or "uncapped").
// They exist ONLY so that call sites across the app keep working
// without a coordinated rename; do not add a new gate here, and do
// not reintroduce a tier check. When the last caller of a shim is
// migrated, delete the shim.
//
// The dating-era helpers (`canSeeWhoLikesYou`, `canUseWhispers`,
// `hasUnlimitedLikes`, `hasUnlimitedRewinds`, `getDailyLikeLimit`,
// `DAILY_LIKE_LIMIT_BY_TIER`) describe mechanics the product no longer
// has. They are kept as deprecated shims for the same
// don't-break-callers reason and are marked for deletion below.

export const ALL_FEATURES_FREE = true;

// Everyone has access to everything. Arguments are ignored.
export function hasTierAccess(_currentTier, _requiredTier) {
  return true;
}

// @deprecated Dating mechanic. The app has no like limits — nothing
// reads this map any more. Kept so a stale import resolves; delete
// once no caller references it.
export const DAILY_LIKE_LIMIT_BY_TIER = Object.freeze({
  free: null,
  plus: null,
  junub: null,
});

// @deprecated Dating mechanic. Always uncapped (`null`).
export function getDailyLikeLimit(_tier) {
  return null;
}

// @deprecated Dating mechanic. Delete once callers are migrated.
export function hasUnlimitedLikes(_tier) {
  return true;
}

// @deprecated Dating mechanic. Delete once callers are migrated.
export function hasUnlimitedRewinds(_tier) {
  return true;
}

// @deprecated Dating mechanic. Delete once callers are migrated.
export function canUseWhispers(_tier) {
  return true;
}

// @deprecated Dating mechanic. Delete once callers are migrated.
export function canSeeWhoLikesYou(_tier) {
  return true;
}

// Discovery / privacy features. Free for everyone, like everything
// else — these shims stay because screens still call them.
export function canUseAdvancedFilters(_tier) {
  return true;
}

export function canUseIncognito(_tier) {
  return true;
}

export function canUseDiasporaConnect(_tier) {
  return true;
}

// No subscriptions are sold, so every user is treated as fully
// entitled. Callers use this to decide whether to show "premium"
// affordances; with everything free the honest answer is always yes.
export function isSubscribed(_tier) {
  return true;
}
