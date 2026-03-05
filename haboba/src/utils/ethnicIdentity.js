// ═══════════════════════════════════════════════════════════
// AnaJunubin — Ethnic Group Identity System
// Colors, icons, and labels for South Sudanese ethnic groups.
// Used across ProfileCard, ProfileDetail, Messages, Community.
// ═══════════════════════════════════════════════════════════

const ETHNIC_GROUPS = {
  Dinka: {
    emoji: '\u{1F981}',       // lion
    color: '#C0392B',         // warm ox-blood red (cattle culture)
    tint: 'rgba(192,57,43,0.10)',
    label: 'Dinka',
    icon: 'shield-half',      // Ionicons fallback
  },
  Nuer: {
    emoji: '\u{1F406}',       // leopard
    color: '#1E8449',         // deep savanna green
    tint: 'rgba(30,132,73,0.10)',
    label: 'Nuer',
    icon: 'leaf',
  },
  Shilluk: {
    emoji: '\u{1F451}',       // crown (Reth kingship)
    color: '#6C3483',         // royal purple
    tint: 'rgba(108,52,131,0.10)',
    label: 'Shilluk',
    icon: 'diamond',
  },
  Bari: {
    emoji: '\u{1F33F}',       // herb / green (agriculture)
    color: '#148F77',         // river-teal green
    tint: 'rgba(20,143,119,0.10)',
    label: 'Bari',
    icon: 'water',
  },
  Zande: {
    emoji: '\u{1F6E1}',       // shield (warrior artisans)
    color: '#D4AC0D',         // amber gold
    tint: 'rgba(212,172,13,0.10)',
    label: 'Zande',
    icon: 'flash',
  },
  Acholi: {
    emoji: '\u{1F3B5}',       // music note (dance/music tradition)
    color: '#CA6F1E',         // warm ochre
    tint: 'rgba(202,111,30,0.10)',
    label: 'Acholi',
    icon: 'musical-notes',
  },
  Murle: {
    emoji: '\u{26F0}',        // mountain
    color: '#5B2C6F',         // deep indigo
    tint: 'rgba(91,44,111,0.10)',
    label: 'Murle',
    icon: 'trail-sign',
  },
  Toposa: {
    emoji: '\u{2600}',        // sun
    color: '#D35400',         // burnt orange (eastern plains)
    tint: 'rgba(211,84,0,0.10)',
    label: 'Toposa',
    icon: 'sunny',
  },
  Lotuko: {
    emoji: '\u{1F3D4}',       // mountain with snow (highland)
    color: '#2471A3',         // highland blue
    tint: 'rgba(36,113,163,0.10)',
    label: 'Lotuko',
    icon: 'navigate',
  },
  Madi: {
    emoji: '\u{1F331}',       // seedling (farming)
    color: '#1D8348',         // forest green
    tint: 'rgba(29,131,72,0.10)',
    label: 'Madi',
    icon: 'leaf',
  },
  Luo: {
    emoji: '\u{1F30A}',       // wave (river people)
    color: '#2E86C1',         // Nile blue
    tint: 'rgba(46,134,193,0.10)',
    label: 'Luo',
    icon: 'water',
  },
  Other: {
    emoji: '\u{1F30D}',       // globe
    color: '#F56040',         // app accent
    tint: 'rgba(245,96,64,0.10)',
    label: 'Junub',
    icon: 'earth',
  },
};

// Default fallback for unknown values
const FALLBACK = ETHNIC_GROUPS.Other;

/**
 * Get the identity config for an ethnicity string.
 * @param {string} ethnicity
 * @returns {{ emoji: string, color: string, tint: string, label: string, icon: string }}
 */
export function getEthnicIdentity(ethnicity) {
  if (!ethnicity) return FALLBACK;
  return ETHNIC_GROUPS[ethnicity] || FALLBACK;
}

/**
 * All ethnic group keys (for iteration).
 */
export const ETHNIC_GROUP_KEYS = Object.keys(ETHNIC_GROUPS);

export default ETHNIC_GROUPS;
