// ═══════════════════════════════════════════════════════════
// JuNubin — Ethnic Group Identity (display metadata)
//
// Backed by the canonical tribe data in src/data/tribes.js. This module
// exists to keep the existing import surface stable for components that
// already use `getEthnicIdentity` / `ETHNIC_GROUP_KEYS`.
// ═══════════════════════════════════════════════════════════

import { TRIBES, TRIBE_BY_KEY, getTribe, ALL_TRIBE_KEYS } from '../data/tribes';

const FALLBACK = TRIBE_BY_KEY.Other;

/**
 * Get the identity config for an ethnicity / tribe name.
 * Accepts canonical names ("Dinka") and alt names ("Jieng", "Naadh", etc.).
 * @param {string} ethnicity
 * @returns {{ emoji: string, color: string, tint: string, label: string, icon: string, group: string|null }}
 */
export function getEthnicIdentity(ethnicity) {
  const tribe = getTribe(ethnicity) || FALLBACK;
  return {
    emoji: tribe.emoji,
    color: tribe.color,
    tint: tribe.tint,
    label: tribe.key,
    group: tribe.group,
    // Default Ionicons fallback — kept for any existing consumers
    icon: 'flag',
  };
}

/** All canonical tribe keys (in display order). */
export const ETHNIC_GROUP_KEYS = ALL_TRIBE_KEYS;

/** Backward-compatible default export — keyed by canonical tribe name. */
const ETHNIC_GROUPS = TRIBES.reduce((acc, t) => {
  acc[t.key] = {
    emoji: t.emoji,
    color: t.color,
    tint: t.tint,
    label: t.key,
    icon: 'flag',
  };
  return acc;
}, {});

export default ETHNIC_GROUPS;
