/**
 * Cultural affinity scoring for South Sudanese community matching.
 * Scores ethnic proximity, shared identity stickers, and interest cluster overlap.
 */

// ── Ethnic affinity matrix ──────────────────────────────────────────────────
// Nilotic groups
const NILOTIC = ['Dinka', 'Nuer', 'Shilluk', 'Acholi', 'Luo'];
// Equatorian groups
const EQUATORIAN = ['Bari', 'Lotuko', 'Madi'];

const NILOTIC_AFFINITY = {};
for (const a of NILOTIC) {
  NILOTIC_AFFINITY[a] = {};
  for (const b of NILOTIC) {
    if (a === b) continue;
    // Dinka↔Nuer, Shilluk↔Acholi, Acholi↔Luo have high affinity
    const highPairs = [
      'Dinka-Nuer', 'Nuer-Dinka',
      'Shilluk-Acholi', 'Acholi-Shilluk',
      'Acholi-Luo', 'Luo-Acholi',
      'Dinka-Shilluk', 'Shilluk-Dinka',
    ];
    const key = `${a}-${b}`;
    NILOTIC_AFFINITY[a][b] = highPairs.includes(key) ? 0.7 : 0.5;
  }
}

const EQUATORIAN_AFFINITY = {};
for (const a of EQUATORIAN) {
  EQUATORIAN_AFFINITY[a] = {};
  for (const b of EQUATORIAN) {
    if (a === b) continue;
    // Bari↔Lotuko high, others medium
    const highPairs = ['Bari-Lotuko', 'Lotuko-Bari'];
    const key = `${a}-${b}`;
    EQUATORIAN_AFFINITY[a][b] = highPairs.includes(key) ? 0.7 : 0.5;
  }
}

const NILOTIC_SET = new Set(NILOTIC.map((g) => g.toLowerCase()));
const EQUATORIAN_SET = new Set(EQUATORIAN.map((g) => g.toLowerCase()));

function normalize(str) {
  return typeof str === 'string' ? str.trim().toLowerCase() : '';
}

function titleCase(str) {
  const s = normalize(str);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Score ethnic affinity between two users.
 * Same group: +15, high affinity (≥0.6): +10, medium (≥0.4): +5, base solidarity: +2
 */
export function scoreEthnicAffinity(userEthnicity, candidateEthnicity) {
  const a = normalize(userEthnicity);
  const b = normalize(candidateEthnicity);
  if (!a || !b) return 0;

  // Same group
  if (a === b) return 15;

  const aTitle = titleCase(a);
  const bTitle = titleCase(b);

  // Check within Nilotic group
  if (NILOTIC_SET.has(a) && NILOTIC_SET.has(b)) {
    const affinity = NILOTIC_AFFINITY[aTitle]?.[bTitle] || 0.4;
    if (affinity >= 0.6) return 10;
    if (affinity >= 0.4) return 5;
  }

  // Check within Equatorian group
  if (EQUATORIAN_SET.has(a) && EQUATORIAN_SET.has(b)) {
    const affinity = EQUATORIAN_AFFINITY[aTitle]?.[bTitle] || 0.4;
    if (affinity >= 0.6) return 10;
    if (affinity >= 0.4) return 5;
  }

  // Base South Sudanese solidarity
  return 2;
}

/**
 * Score shared identity stickers.
 * +8 pts per shared sticker, max 5 stickers = up to +40.
 */
export function scoreStickerAffinity(userStickers, candidateStickers) {
  const a = Array.isArray(userStickers) ? userStickers : [];
  const b = Array.isArray(candidateStickers) ? candidateStickers : [];
  if (a.length === 0 || b.length === 0) return 0;

  const userLabels = new Set(a.map((s) => normalize(typeof s === 'string' ? s : s?.label || '')));

  let shared = 0;
  for (const sticker of b) {
    const label = normalize(typeof sticker === 'string' ? sticker : sticker?.label || '');
    if (label && userLabels.has(label)) {
      shared++;
      if (shared >= 5) break;
    }
  }

  return shared * 8;
}

// ── Interest cluster matching ───────────────────────────────────────────────
const INTEREST_CLUSTERS = {
  traditional: new Set(['culture', 'faith', 'cooking', 'volunteering']),
  creative: new Set(['art', 'fashion', 'photography', 'poetry']),
  active: new Set(['fitness', 'basketball', 'soccer', 'running', 'dancing']),
  intellectual: new Set(['reading', 'tech', 'history', 'languages']),
  social: new Set(['music', 'travel', 'food', 'nature']),
};

function getClusters(interests) {
  const arr = Array.isArray(interests) ? interests : [];
  const clusters = new Set();
  for (const interest of arr) {
    const lower = normalize(interest);
    for (const [cluster, members] of Object.entries(INTEREST_CLUSTERS)) {
      if (members.has(lower)) {
        clusters.add(cluster);
      }
    }
  }
  return clusters;
}

/**
 * Score interest cluster overlap.
 * +5 pts per shared cluster.
 */
export function scoreInterestClusterMatch(userInterests, candidateInterests) {
  const userClusters = getClusters(userInterests);
  const candidateClusters = getClusters(candidateInterests);
  if (userClusters.size === 0 || candidateClusters.size === 0) return 0;

  let shared = 0;
  for (const cluster of userClusters) {
    if (candidateClusters.has(cluster)) shared++;
  }

  return shared * 5;
}

/**
 * Combined cultural affinity score.
 * Sums ethnic affinity, sticker affinity, and interest cluster matching.
 * Potential up to ~50 pts.
 */
export function scoreCulturalAffinity(currentUserProfile, candidateProfile) {
  const userProfile = currentUserProfile || {};
  const candProfile = candidateProfile || {};

  let score = 0;

  score += scoreEthnicAffinity(userProfile.ethnicity, candProfile.ethnicity);
  score += scoreStickerAffinity(userProfile.stickers, candProfile.stickers);
  score += scoreInterestClusterMatch(userProfile.interests, candProfile.interests);

  return score;
}
