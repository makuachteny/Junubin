/**
 * Keyword extraction and overlap scoring for profile-based matching.
 * Extracts keywords from bios/prompts and scores overlap with cultural weighting.
 */

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with',
  'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'out', 'off', 'over', 'under', 'again', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'about', 'up', 'down', 'if', 'it', 'its', 'my',
  'your', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them', 'i', 'you', 'he',
  'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
  'those', 'am', 'im', 'ive', 'dont', 'doesnt', 'didnt', 'wont', 'cant', 'also',
  'like', 'really', 'get', 'got', 'much', 'well', 'still', 'even',
]);

// South Sudanese cultural keywords — get 2.5x scoring weight
const CULTURAL_KEYWORDS = new Set([
  'juba', 'bor', 'malakal', 'wau', 'rumbek', 'aweil', 'torit', 'yei', 'nimule',
  'dinka', 'nuer', 'shilluk', 'acholi', 'bari', 'lotuko', 'madi', 'zande', 'luo',
  'cattle', 'church', 'wrestling', 'asida', 'kisra', 'junub', 'junubin',
  'diaspora', 'beadwork', 'nyamuora', 'luak', 'cordit',
  'south sudan', 'sudanese', 'nilotic', 'equatoria',
  'gospel', 'faith', 'prayer', 'sunday',
  'traditional', 'culture', 'heritage', 'tribe', 'clan',
  'nile', 'sudd', 'jonglei', 'unity',
]);

/**
 * Tokenize text: lowercase, split on non-alpha, remove stop words, deduplicate.
 * @param {string} text
 * @returns {{ word: string, isCultural: boolean }[]}
 */
export function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];

  const lower = text.toLowerCase();
  // Extract multi-word cultural phrases first
  const found = new Set();
  const result = [];

  for (const phrase of CULTURAL_KEYWORDS) {
    if (phrase.includes(' ') && lower.includes(phrase)) {
      if (!found.has(phrase)) {
        found.add(phrase);
        result.push({ word: phrase, isCultural: true });
      }
    }
  }

  // Tokenize remaining single words
  const tokens = lower.split(/[^a-z']+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    if (found.has(token)) continue;
    found.add(token);
    result.push({
      word: token,
      isCultural: CULTURAL_KEYWORDS.has(token),
    });
  }

  return result;
}

/**
 * Combine text fields from a profile for keyword extraction.
 */
function getProfileText(profile) {
  const parts = [];
  if (profile?.bio) parts.push(profile.bio);
  if (profile?.promptAnswer) parts.push(profile.promptAnswer);
  if (profile?.lookingFor) parts.push(profile.lookingFor);
  return parts.join(' ');
}

/**
 * Score keyword overlap between two profiles.
 * Cultural keyword match: +8 pts, regular: +3 pts, capped at +25.
 */
export function scoreKeywordOverlap(userProfile, candidateProfile) {
  const userText = getProfileText(userProfile);
  const candText = getProfileText(candidateProfile);

  const userKeywords = extractKeywords(userText);
  const candKeywords = extractKeywords(candText);
  if (userKeywords.length === 0 || candKeywords.length === 0) return 0;

  const candMap = new Map();
  for (const kw of candKeywords) {
    candMap.set(kw.word, kw.isCultural);
  }

  let score = 0;
  for (const kw of userKeywords) {
    if (candMap.has(kw.word)) {
      // Cultural match if either side tags it as cultural
      const isCultural = kw.isCultural || candMap.get(kw.word);
      score += isCultural ? 8 : 3;
    }
  }

  return Math.min(score, 25);
}

/**
 * Score profile freshness based on updatedAt.
 * <1 day: +10, <3 days: +7, <7 days: +5, otherwise: 0.
 */
export function scoreProfileFreshness(candidateProfile) {
  if (!candidateProfile?.updatedAt) return 0;

  const updated = new Date(candidateProfile.updatedAt);
  const hoursAgo = (Date.now() - updated.getTime()) / (1000 * 60 * 60);

  if (hoursAgo < 24) return 10;
  if (hoursAgo < 72) return 7;
  if (hoursAgo < 168) return 5;
  return 0;
}
