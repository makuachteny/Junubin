const DEFAULT_WEIGHTS = {
  sharedInterests: 1,
  datingIntentions: 1,
  recency: 1,
  verified: 1,
  photos: 1,
  bio: 1,
  culturalAffinity: 1,
  keywordOverlap: 1,
  profileFreshness: 1,
  currentlyInto: 1,
  behavioral: 1,
  popularity: 1,
  collaborative: 1,
};

function parseNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseWeights(raw) {
  if (!raw) return DEFAULT_WEIGHTS;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return DEFAULT_WEIGHTS;
    }
    const weights = { ...DEFAULT_WEIGHTS };
    Object.keys(DEFAULT_WEIGHTS).forEach((key) => {
      if (parsed[key] != null) {
        weights[key] = parseNumber(parsed[key], DEFAULT_WEIGHTS[key], 0, 4);
      }
    });
    return weights;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export const matchingConfig = {
  exploreRate: parseNumber(process.env.MATCH_EXPLORE_RATE, 0.15, 0, 1),
  windowSize: Math.round(parseNumber(process.env.MATCH_WINDOW_SIZE, 5, 2, 20)),
  behavioralMinSwipes: Math.round(
    parseNumber(process.env.MATCH_BEHAVIORAL_MIN_SWIPES, 20, 5, 200)
  ),
  analyticsEnabled: process.env.MATCH_ANALYTICS_ENABLED === 'true',
  analyticsSampleRate: parseNumber(process.env.MATCH_ANALYTICS_SAMPLE_RATE, 0.1, 0, 1),
  analyticsTopK: Math.round(parseNumber(process.env.MATCH_ANALYTICS_TOP_K, 3, 1, 10)),
  weights: parseWeights(process.env.MATCH_WEIGHTS_JSON),
};
