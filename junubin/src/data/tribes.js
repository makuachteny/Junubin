// ═══════════════════════════════════════════════════════════
// JuNubin — South Sudan Tribes / Ethnic Groups
//
// One source of truth for tribe data, used by:
//   - ProfileSetup → ethnicity step
//   - Preferences → "Ethnicity" selector
//   - Likes → ethnicity filter
//   - ProfileCard / ProfileDetail → identity badge (via ethnicIdentity.js)
//   - Community → tribe-tagged posts
//
// South Sudan has 64 indigenous ethnic groups, broadly organised into three
// language families: Nilotic (cattle-rearing river peoples), Eastern Sudanic
// / Nilo-Hamitic (mostly Equatoria), and Central Sudanic / Ubangian (mostly
// agriculturalists in the south and west). No two public 64-tribe lists
// align perfectly — compilers split or merge smaller groups differently.
// This list follows the consolidated enumeration used by South Sudanese
// civil-society sources and includes commonly-cited names + altNames.
// ═══════════════════════════════════════════════════════════

// ── Language-family groupings (used as section headers in pickers) ──
export const TRIBE_GROUPS = {
  Nilotic: {
    key: 'Nilotic',
    label: 'Nilotic',
    description: 'Cattle-rearing peoples of the Nile valley',
    color: '#1E8449',
  },
  EasternSudanic: {
    key: 'EasternSudanic',
    label: 'Nilo-Hamitic / Equatorian',
    description: 'Eastern Sudanic peoples, primarily in Equatoria',
    color: '#D4AC0D',
  },
  CentralSudanic: {
    key: 'CentralSudanic',
    label: 'Central Sudanic / Ubangian',
    description: 'Agriculturalist peoples of the south and west',
    color: '#6C3483',
  },
};

// ── Ordered list (largest / most prominent first, then alphabetical) ──
// `branches` lists notable sub-groups documented as named in their own right.
// `popular: true` marks the dozen or so groups surfaced in the main UI; the
// rest are still selectable via "More tribes" sections.
export const TRIBES = [
  // ─── Major groups (popular: true) ────────────────────────────────
  {
    key: 'Dinka',
    altNames: ['Jieng'],
    group: 'Nilotic',
    branches: ['Agar', 'Bor', 'Padaang', 'Rek'],
    region: 'Bahr el Ghazal / Jonglei / Upper Nile',
    note: 'Largest group (~40%) — agropastoralists along the Nile',
    emoji: '\u{1F981}',          // lion
    color: '#C0392B',
    tint: 'rgba(192,57,43,0.10)',
    popular: true,
  },
  {
    key: 'Nuer',
    altNames: ['Naadh'],
    group: 'Nilotic',
    branches: ['Central Nuer', 'Eastern Nuer', 'Western Nuer'],
    region: 'Upper Nile / Jonglei / Unity',
    note: 'Second largest (~20%) — cattle herders',
    emoji: '\u{1F406}',          // leopard
    color: '#1E8449',
    tint: 'rgba(30,132,73,0.10)',
    popular: true,
  },
  {
    key: 'Azande',
    altNames: ['Zande'],
    group: 'CentralSudanic',
    region: 'Western Equatoria',
    note: 'Third largest — known for crafts and ironwork',
    emoji: '\u{1F6E1}',          // shield
    color: '#D4AC0D',
    tint: 'rgba(212,172,13,0.10)',
    popular: true,
  },
  {
    key: 'Bari',
    group: 'EasternSudanic',
    branches: ['Kakwa', 'Kuku', 'Nyangwara', 'Pojulu', 'Nyepu'],
    region: 'Central Equatoria — Juba area',
    note: 'Riverine farmers near the capital',
    emoji: '\u{1F33F}',          // herb
    color: '#148F77',
    tint: 'rgba(20,143,119,0.10)',
    popular: true,
  },
  {
    key: 'Shilluk',
    altNames: ['Chollo'],
    group: 'Nilotic',
    region: 'Upper Nile (west bank)',
    note: 'Historic Reth (king) monarchy',
    emoji: '\u{1F451}',          // crown
    color: '#6C3483',
    tint: 'rgba(108,52,131,0.10)',
    popular: true,
  },
  {
    key: 'Murle',
    group: 'EasternSudanic',
    region: 'Jonglei (Pibor)',
    emoji: '\u{26F0}',           // mountain
    color: '#5B2C6F',
    tint: 'rgba(91,44,111,0.10)',
    popular: true,
  },
  {
    key: 'Toposa',
    altNames: ['Taposa'],
    group: 'EasternSudanic',
    region: 'Eastern Equatoria',
    emoji: '\u{2600}',           // sun
    color: '#D35400',
    tint: 'rgba(211,84,0,0.10)',
    popular: true,
  },
  {
    key: 'Lotuko',
    altNames: ['Otuho', 'Lotuha'],
    group: 'EasternSudanic',
    region: 'Eastern Equatoria — Imatong mountains',
    note: 'Mountain-dwellers of the highlands',
    emoji: '\u{1F3D4}',          // snowy mountain
    color: '#2471A3',
    tint: 'rgba(36,113,163,0.10)',
    popular: true,
  },
  {
    key: 'Mundari',
    group: 'EasternSudanic',
    region: 'Central Equatoria',
    note: 'Cattle-herders of the Nile (Bari-related)',
    emoji: '\u{1F404}',          // ox
    color: '#7D6608',
    tint: 'rgba(125,102,8,0.10)',
    popular: true,
  },
  {
    key: 'Acholi',
    group: 'Nilotic',
    region: 'Magwi (border with Uganda)',
    emoji: '\u{1F3B5}',          // music note
    color: '#CA6F1E',
    tint: 'rgba(202,111,30,0.10)',
    popular: true,
  },
  {
    key: 'Madi',
    group: 'CentralSudanic',
    region: 'Eastern Equatoria — Nimule',
    emoji: '\u{1F331}',          // seedling
    color: '#1D8348',
    tint: 'rgba(29,131,72,0.10)',
    popular: true,
  },
  {
    key: 'Luwo',
    altNames: ['Luo', 'Jur Chol', 'Jur'],
    group: 'Nilotic',
    region: 'Bahr el Ghazal',
    note: 'Western Nilotic — Jur Chol cluster',
    emoji: '\u{1F30A}',          // wave
    color: '#2E86C1',
    tint: 'rgba(46,134,193,0.10)',
    popular: true,
  },

  // ─── Remaining tribes (alphabetical) ─────────────────────────────
  { key: 'Aja',            group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33E}', color: '#A04000', tint: 'rgba(160,64,0,0.10)' },
  { key: 'Anuak',          altNames: ['Anyuak'],                  group: 'Nilotic',        region: 'Eastern South Sudan',                   emoji: '\u{1F33E}', color: '#27AE60', tint: 'rgba(39,174,96,0.10)' },
  { key: 'Atuot',          altNames: ['Reel'],                    group: 'Nilotic',        region: 'Lakes State',                            note: 'Western Nilotic — Nuer-related',          emoji: '\u{1F404}', color: '#117A65', tint: 'rgba(17,122,101,0.10)' },
  { key: 'Avokaya',        altNames: ['Avukaya'],                 group: 'CentralSudanic', region: 'Western Equatoria',                      emoji: '\u{1F332}', color: '#7E5109', tint: 'rgba(126,81,9,0.10)' },
  { key: 'Bai',            group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33B}', color: '#9C640C', tint: 'rgba(156,100,12,0.10)' },
  { key: 'Baka',           group: 'CentralSudanic', region: 'Western Equatoria',                      emoji: '\u{1F332}', color: '#196F3D', tint: 'rgba(25,111,61,0.10)' },
  { key: 'Balanda Boor',   altNames: ['Belanda Bor', 'Boor'],     group: 'Nilotic',        region: 'Western Bahr el Ghazal',                 note: 'Nilotic-speaking Balanda branch',         emoji: '\u{1F33E}', color: '#B7950B', tint: 'rgba(183,149,11,0.10)' },
  { key: 'Balanda Bviri',  altNames: ['Belanda Viri', 'Bviri'],   group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 note: 'Ubangian-speaking Balanda branch',        emoji: '\u{1F33B}', color: '#7D6608', tint: 'rgba(125,102,8,0.10)' },
  { key: 'Banda',          group: 'CentralSudanic', region: 'Western Equatoria',                      emoji: '\u{1F344}', color: '#6E2C00', tint: 'rgba(110,44,0,0.10)' },
  { key: 'Binga',          group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33C}', color: '#7B7D34', tint: 'rgba(123,125,52,0.10)' },
  { key: 'Bongo',          group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F941}', color: '#7D6608', tint: 'rgba(125,102,8,0.10)' },
  { key: 'Boya',           altNames: ['Larim', 'Longarim'],       group: 'EasternSudanic', region: 'Eastern Equatoria',                      emoji: '\u{2600}',  color: '#CA6F1E', tint: 'rgba(202,111,30,0.10)' },
  { key: 'Burun',          group: 'Nilotic',        region: 'Upper Nile',                             note: 'Burun-Maban linguistic complex',          emoji: '\u{1F30A}', color: '#21618C', tint: 'rgba(33,97,140,0.10)' },
  { key: 'Didinga',        group: 'EasternSudanic', region: 'Eastern Equatoria',                      emoji: '\u{1F3D4}', color: '#5D6D7E', tint: 'rgba(93,109,126,0.10)' },
  { key: 'Dongotono',      altNames: ['Dungotono'],               group: 'EasternSudanic', region: 'Eastern Equatoria',                      emoji: '\u{26F0}',  color: '#6C3483', tint: 'rgba(108,52,131,0.10)' },
  { key: 'Fertit',         group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 note: 'Umbrella term for several smaller groups', emoji: '\u{1F30D}', color: '#5D4037', tint: 'rgba(93,64,55,0.10)' },
  { key: 'Gbaya',          altNames: ['Kreish', 'Gbaya-Kresh'],   group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F344}', color: '#641E16', tint: 'rgba(100,30,22,0.10)' },
  { key: 'Golo',           altNames: ['Gollo'],                   group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33C}', color: '#9A7D0A', tint: 'rgba(154,125,10,0.10)' },
  { key: 'Ifoto',          group: 'EasternSudanic', region: 'Eastern Equatoria',                      note: 'Lotuko-related highland community',       emoji: '\u{1F3D4}', color: '#7B241C', tint: 'rgba(123,36,28,0.10)' },
  { key: 'Imatong',        group: 'EasternSudanic', region: 'Eastern Equatoria — Imatong range',      note: 'Lotuko-related highland community',       emoji: '\u{26F0}',  color: '#5D6D7E', tint: 'rgba(93,109,126,0.10)' },
  { key: 'Indri',          group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33B}', color: '#A04000', tint: 'rgba(160,64,0,0.10)' },
  { key: 'Jiye',           altNames: ['Jie'],                     group: 'Nilotic',        region: 'Eastern Equatoria',                      note: 'Eastern Nilotic — Toposa-related',        emoji: '\u{2600}',  color: '#B9770E', tint: 'rgba(185,119,14,0.10)' },
  { key: 'Jur Beli',       group: 'CentralSudanic', region: 'Bahr el Ghazal',                         emoji: '\u{1F31E}', color: '#943126', tint: 'rgba(148,49,38,0.10)' },
  { key: 'Jur Modo',       group: 'CentralSudanic', region: 'Western Equatoria',                      emoji: '\u{1F33F}', color: '#0E6251', tint: 'rgba(14,98,81,0.10)' },
  { key: 'Jur Manangeer',  altNames: ['Jur Mananger', 'Manangeer'], group: 'CentralSudanic', region: 'Bahr el Ghazal',                       emoji: '\u{1F33E}', color: '#7D6608', tint: 'rgba(125,102,8,0.10)' },
  { key: 'Kakwa',          group: 'EasternSudanic', region: 'Central Equatoria (Bari branch)',        emoji: '\u{1F981}', color: '#A04000', tint: 'rgba(160,64,0,0.10)' },
  { key: 'Kaligi',         altNames: ['Feroge', 'Feroghe'],       group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F344}', color: '#6E2C00', tint: 'rgba(110,44,0,0.10)' },
  { key: 'Koma',           group: 'Nilotic',        region: 'Upper Nile (border)',                    note: 'Koma-Uduk-Burun complex',                 emoji: '\u{1F33F}', color: '#0B5345', tint: 'rgba(11,83,69,0.10)' },
  { key: 'Kuku',           group: 'EasternSudanic', region: 'Central Equatoria (Bari branch)',        emoji: '\u{1F33F}', color: '#117864', tint: 'rgba(17,120,100,0.10)' },
  { key: 'Lango',          altNames: ['Langi'],                   group: 'EasternSudanic', region: 'Eastern Equatoria',                      note: 'South Sudan Lango — Lotuko cluster',      emoji: '\u{1F3B6}', color: '#7D3C98', tint: 'rgba(125,60,152,0.10)' },
  { key: 'Lirya',          group: 'EasternSudanic', region: 'Eastern Equatoria',                      note: 'Lotuko-related community',                emoji: '\u{2600}',  color: '#9C640C', tint: 'rgba(156,100,12,0.10)' },
  { key: 'Lokoya',         group: 'EasternSudanic', region: 'Eastern Equatoria',                      note: 'Lotuko-related community',                emoji: '\u{26F0}',  color: '#7B241C', tint: 'rgba(123,36,28,0.10)' },
  { key: 'Lopit',          group: 'EasternSudanic', region: 'Eastern Equatoria — Lopit hills',        emoji: '\u{1F3D4}', color: '#5D6D7E', tint: 'rgba(93,109,126,0.10)' },
  { key: 'Lulubo',         altNames: ['Olubo'],                   group: 'EasternSudanic', region: 'Central Equatoria',                      emoji: '\u{1F33F}', color: '#0E6251', tint: 'rgba(14,98,81,0.10)' },
  { key: 'Maaban',         altNames: ['Maban'],                   group: 'Nilotic',        region: 'Upper Nile',                             note: 'Burun-Maban complex',                     emoji: '\u{1F30A}', color: '#1F618D', tint: 'rgba(31,97,141,0.10)' },
  { key: 'Mangayat',       group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33B}', color: '#9C640C', tint: 'rgba(156,100,12,0.10)' },
  { key: 'Morokodo',       group: 'CentralSudanic', region: 'Western Equatoria',                      emoji: '\u{1F33F}', color: '#196F3D', tint: 'rgba(25,111,61,0.10)' },
  { key: 'Moru',           group: 'CentralSudanic', region: 'Western Equatoria',                      emoji: '\u{1F332}', color: '#1D8348', tint: 'rgba(29,131,72,0.10)' },
  { key: 'Mundu',          group: 'CentralSudanic', region: 'Western Equatoria',                      emoji: '\u{1F344}', color: '#7B241C', tint: 'rgba(123,36,28,0.10)' },
  { key: 'Ndogo',          group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33D}', color: '#1A5276', tint: 'rgba(26,82,118,0.10)' },
  { key: 'Ngulgule',       altNames: ['Nyolge'],                  group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33C}', color: '#7E5109', tint: 'rgba(126,81,9,0.10)' },
  { key: 'Nyangatom',      group: 'EasternSudanic', region: 'Eastern Equatoria',                      emoji: '\u{1F404}', color: '#7E5109', tint: 'rgba(126,81,9,0.10)' },
  { key: 'Nyangwara',      altNames: ['Nyangbara'],               group: 'EasternSudanic', region: 'Central Equatoria (Bari branch)',        emoji: '\u{1F33E}', color: '#9A7D0A', tint: 'rgba(154,125,10,0.10)' },
  { key: 'Nyepu',          altNames: ['Nyepo'],                   group: 'EasternSudanic', region: 'Equatoria (Bari branch)',                emoji: '\u{1F33A}', color: '#922B21', tint: 'rgba(146,43,33,0.10)' },
  { key: 'Pari',           altNames: ['Päri'],                    group: 'Nilotic',        region: 'Eastern Equatoria — Lafon hill',         note: 'Western Nilotic — Luo-related',           emoji: '\u{1F30A}', color: '#1F618D', tint: 'rgba(31,97,141,0.10)' },
  { key: 'Pojulu',         group: 'EasternSudanic', region: 'Central Equatoria (Bari branch)',        emoji: '\u{1F344}', color: '#6E2C00', tint: 'rgba(110,44,0,0.10)' },
  { key: 'Sere',           group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33F}', color: '#0E6251', tint: 'rgba(14,98,81,0.10)' },
  { key: 'Suri',           altNames: ['Kichepo', 'Baale'],        group: 'EasternSudanic', region: 'Eastern Equatoria',                      emoji: '\u{1F3D4}', color: '#5B2C6F', tint: 'rgba(91,44,111,0.10)' },
  { key: 'Tennet',         group: 'EasternSudanic', region: 'Eastern Equatoria',                      emoji: '\u{2600}',  color: '#B9770E', tint: 'rgba(185,119,14,0.10)' },
  { key: 'Thuri',          altNames: ['Shatt', 'Shat'],           group: 'Nilotic',        region: 'Bahr el Ghazal',                         note: 'Western Nilotic — Luo-related',           emoji: '\u{1F30A}', color: '#2E86C1', tint: 'rgba(46,134,193,0.10)' },
  { key: 'Uduk',           group: 'Nilotic',        region: 'Upper Nile',                             note: 'Koma-Uduk-Burun complex',                 emoji: '\u{1F33E}', color: '#196F3D', tint: 'rgba(25,111,61,0.10)' },
  { key: 'Yulu',           group: 'CentralSudanic', region: 'Western Bahr el Ghazal',                 emoji: '\u{1F33C}', color: '#7E5109', tint: 'rgba(126,81,9,0.10)' },

  // ─── Catch-alls for users who prefer not to specify ───────────────
  {
    key: 'South Sudanese',
    group: null,
    note: 'Pan-tribal identity',
    emoji: '\u{1F1F8}\u{1F1F8}',  // SS flag pair
    color: '#009739',
    tint: 'rgba(0,151,57,0.10)',
    popular: true,
  },
  {
    key: 'Other',
    group: null,
    emoji: '\u{1F30D}',           // globe
    color: '#009739',
    tint: 'rgba(0,151,57,0.10)',
  },
];

// ── Lookup map ──
export const TRIBE_BY_KEY = TRIBES.reduce((acc, t) => {
  acc[t.key] = t;
  // alt names map back to the canonical record
  (t.altNames || []).forEach((alt) => { acc[alt] = t; });
  return acc;
}, {});

// ── Convenience: keys for the main UI (chips, filters, default picker) ──
export const POPULAR_TRIBE_KEYS = TRIBES.filter((t) => t.popular).map((t) => t.key);

// ── Convenience: all keys ──
export const ALL_TRIBE_KEYS = TRIBES.map((t) => t.key);

// ── Group → tribes lookup, useful for sectioned pickers ──
export const TRIBES_BY_GROUP = Object.keys(TRIBE_GROUPS).reduce((acc, g) => {
  acc[g] = TRIBES.filter((t) => t.group === g);
  return acc;
}, {});

/**
 * Resolve tribe metadata from any name, alt-name, or arbitrary string.
 * Falls back to the "Other" record so callers always get a usable shape.
 */
export function getTribe(name) {
  if (!name) return TRIBE_BY_KEY.Other;
  return TRIBE_BY_KEY[name] || TRIBE_BY_KEY.Other;
}

export default TRIBES;
