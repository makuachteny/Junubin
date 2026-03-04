/**
 * Discovery scoring utility.
 * Scores candidate profiles against the current user for smarter ordering.
 */

import { scoreCulturalAffinity } from './culturalAffinity.js';
import { scoreKeywordOverlap, scoreProfileFreshness } from './keywords.js';
import { matchingConfig } from '../config/matching.js';

const weighted = (value, key) =>
  Math.round(value * (matchingConfig.weights[key] ?? 1));

/**
 * Score a single candidate against the current user's profile.
 * @param {object} candidate - Prisma user with profile included
 * @param {object} currentUserProfile - Current user's profile record
 * @param {object} opts - Optional scoring context { preferenceVector, popularityMap, collaborativeBoosts }
 * @returns {number} compatibility score
 */
export function scoreCandidate(candidate, currentUserProfile, opts = {}) {
  return scoreCandidateDetailed(candidate, currentUserProfile, opts).score;
}

export function scoreCandidateDetailed(candidate, currentUserProfile, opts = {}) {
  let score = 0;
  const candidateProfile = candidate.profile || {};
  const breakdown = {};
  const addScore = (key, rawPoints) => {
    if (!rawPoints) return;
    const weightedPoints = weighted(rawPoints, key);
    score += weightedPoints;
    breakdown[key] = (breakdown[key] || 0) + weightedPoints;
  };

  // Shared interests: 10 pts each
  const myInterests = Array.isArray(currentUserProfile?.interests) ? currentUserProfile.interests : [];
  const theirInterests = Array.isArray(candidateProfile.interests) ? candidateProfile.interests : [];
  let sharedInterestRaw = 0;
  if (myInterests.length > 0 && theirInterests.length > 0) {
    const mySet = new Set(myInterests.map((i) => (typeof i === 'string' ? i.toLowerCase() : '')));
    for (const interest of theirInterests) {
      if (mySet.has(typeof interest === 'string' ? interest.toLowerCase() : '')) {
        sharedInterestRaw += 10;
      }
    }
  }
  addScore('sharedInterests', sharedInterestRaw);

  // Matching dating intentions: 20 pts
  if (
    currentUserProfile?.datingIntentions &&
    candidateProfile.datingIntentions &&
    currentUserProfile.datingIntentions.toLowerCase() === candidateProfile.datingIntentions.toLowerCase()
  ) {
    addScore('datingIntentions', 20);
  }

  // Recency bonus based on lastActiveAt
  if (candidate.lastActiveAt) {
    const hoursSinceActive = (Date.now() - new Date(candidate.lastActiveAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceActive < 1) addScore('recency', 30);
    else if (hoursSinceActive < 24) addScore('recency', 20);
    else if (hoursSinceActive < 72) addScore('recency', 10);
  }

  // Verified: 5 pts
  if (candidate.isVerified) {
    addScore('verified', 5);
  }

  // 3+ photos: 10 pts
  if (candidate.photos && candidate.photos.length >= 3) {
    addScore('photos', 10);
  }

  // Has bio: 5 pts
  if (candidateProfile.bio && candidateProfile.bio.trim().length > 0) {
    addScore('bio', 5);
  }

  // ── Phase 1: Cultural Affinity + Keywords ──
  addScore('culturalAffinity', scoreCulturalAffinity(currentUserProfile, candidateProfile));
  addScore('keywordOverlap', scoreKeywordOverlap(currentUserProfile, candidateProfile));
  addScore('profileFreshness', scoreProfileFreshness(candidateProfile));

  // ── Phase 2: "Currently Into" ──
  addScore('currentlyInto', scoreCurrentlyInto(currentUserProfile, candidateProfile));

  // ── Phase 3: Behavioral Learning ──
  if (opts.preferenceVector) {
    addScore('behavioral', scoreBehavioral(candidateProfile, candidate, opts.preferenceVector));
  }

  // ── Phase 4: Community Patterns ──
  if (opts.popularityMap) {
    addScore('popularity', scorePopularity(opts.popularityMap[candidate.id]));
  }
  if (opts.collaborativeBoosts?.[candidate.id]) {
    addScore('collaborative', opts.collaborativeBoosts[candidate.id]);
  }

  return { score, breakdown };
}

// ── Phase 2: "Currently Into" scoring ───────────────────────────────────────

/**
 * Score "Currently Into" overlap between two profiles.
 * Both share same item: +25 each, candidate interest matches user's currentlyInto: +8,
 * candidate updated currentlyInto within 48hrs: +5 freshness.
 */
function scoreCurrentlyInto(currentUserProfile, candidateProfile) {
  const userInto = Array.isArray(currentUserProfile?.currentlyInto) ? currentUserProfile.currentlyInto : [];
  const candInto = Array.isArray(candidateProfile?.currentlyInto) ? candidateProfile.currentlyInto : [];
  const candInterests = Array.isArray(candidateProfile?.interests) ? candidateProfile.interests : [];

  let score = 0;

  if (userInto.length > 0 && candInto.length > 0) {
    const candIntoSet = new Set(candInto.map((s) => (typeof s === 'string' ? s.toLowerCase() : '')));
    for (const item of userInto) {
      if (candIntoSet.has(typeof item === 'string' ? item.toLowerCase() : '')) {
        score += 25;
      }
    }
  }

  // Candidate's permanent interests match user's "Currently Into"
  if (userInto.length > 0 && candInterests.length > 0) {
    const candInterestSet = new Set(candInterests.map((s) => (typeof s === 'string' ? s.toLowerCase() : '')));
    for (const item of userInto) {
      if (candInterestSet.has(typeof item === 'string' ? item.toLowerCase() : '')) {
        score += 8;
      }
    }
  }

  // Freshness bonus: candidate updated currentlyInto within 48 hours
  if (candInto.length > 0 && candidateProfile?.currentlyIntoSetAt) {
    const hoursAgo = (Date.now() - new Date(candidateProfile.currentlyIntoSetAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 48) score += 5;
  }

  return score;
}

// ── Phase 3: Behavioral Learning scoring ────────────────────────────────────

/**
 * Score a candidate against a user's learned preference vector.
 * Total potential: ~60 pts.
 */
function scoreBehavioral(candidateProfile, candidate, vector) {
  if (!vector || vector.swipesAnalyzed < matchingConfig.behavioralMinSwipes) return 0;

  let score = 0;

  // Ethnicity alignment: weight * 15 (up to ±15)
  if (vector.ethnicityWeights && candidateProfile?.ethnicity) {
    const eth = candidateProfile.ethnicity;
    const weight = vector.ethnicityWeights[eth] || 0;
    score += Math.round(weight * 15);
  }

  // Interest alignment: sum of weight * 5 per matching interest (up to ±20)
  if (vector.interestWeights && Array.isArray(candidateProfile?.interests)) {
    let interestScore = 0;
    for (const interest of candidateProfile.interests) {
      const weight = vector.interestWeights[interest] || 0;
      interestScore += weight * 5;
    }
    score += Math.round(Math.max(-20, Math.min(20, interestScore)));
  }

  // Age range fit: +10 if within learned preferred range
  if (vector.preferredAgeMin != null && vector.preferredAgeMax != null && candidate?.dateOfBirth) {
    const dob = new Date(candidate.dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
      age--;
    }
    if (age >= vector.preferredAgeMin && age <= vector.preferredAgeMax) {
      score += 10;
    }
  }

  // Height range fit: +5 if within learned preferred range
  if (vector.preferredHeightMin != null && vector.preferredHeightMax != null && candidateProfile?.heightCm) {
    if (candidateProfile.heightCm >= vector.preferredHeightMin && candidateProfile.heightCm <= vector.preferredHeightMax) {
      score += 5;
    }
  }

  // Sticker alignment: up to ±10
  if (vector.stickerWeights && Array.isArray(candidateProfile?.stickers)) {
    let stickerScore = 0;
    for (const sticker of candidateProfile.stickers) {
      const label = typeof sticker === 'string' ? sticker : sticker?.label || '';
      const weight = vector.stickerWeights[label] || 0;
      stickerScore += weight * 5;
    }
    score += Math.round(Math.max(-10, Math.min(10, stickerScore)));
  }

  // Intention alignment: up to ±10
  if (vector.intentionWeights && candidateProfile?.datingIntentions) {
    const weight = vector.intentionWeights[candidateProfile.datingIntentions] || 0;
    score += Math.round(Math.max(-10, Math.min(10, weight * 10)));
  }

  return score;
}

// ── Phase 4: Popularity scoring ─────────────────────────────────────────────

/**
 * Score based on community popularity (Elo).
 * Elo > 1200: +15, > 1100: +10, > 1000: +5, ≤ 1000: +0.
 */
function scorePopularity(popularityRecord) {
  if (!popularityRecord) return 0;
  const elo = popularityRecord.eloScore || 1000;
  if (elo > 1200) return 15;
  if (elo > 1100) return 10;
  if (elo > 1000) return 5;
  return 0;
}

/**
 * Score and rank candidates, then shuffle within windows for variety.
 * @param {object[]} candidates - Array of Prisma users with profile+photos
 * @param {object} currentUserProfile - Current user's profile record
 * @param {number} limit - Max results to return
 * @param {number} windowSize - Shuffle window size (default 5)
 * @param {object} opts - Optional { preferenceVector, popularityMap, collaborativeBoosts }
 * @returns {object[]} Scored, ranked, and shuffled candidates
 */
export function rankCandidates(
  candidates,
  currentUserProfile,
  limit,
  windowSize = matchingConfig.windowSize,
  opts = {}
) {
  // Score each candidate
  const scored = candidates.map((c) => ({
    candidate: c,
    ...scoreCandidateDetailed(c, currentUserProfile, opts),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Controlled exploration: shuffle some windows for variety while preserving ranking quality.
  const exploreRate = typeof opts.exploreRate === 'number'
    ? Math.max(0, Math.min(1, opts.exploreRate))
    : matchingConfig.exploreRate;

  const result = [];
  for (let i = 0; i < scored.length; i += windowSize) {
    const window = scored.slice(i, i + windowSize);
    if (Math.random() < exploreRate) {
      for (let j = window.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [window[j], window[k]] = [window[k], window[j]];
      }
    }
    result.push(...window);
  }

  const limited = result.slice(0, limit);
  if (opts.includeScores) {
    return limited.map((item) => ({
      candidate: item.candidate,
      score: item.score,
      breakdown: item.breakdown,
    }));
  }

  return limited.map((item) => item.candidate);
}
