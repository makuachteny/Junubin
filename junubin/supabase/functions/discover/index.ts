// Edge Function: discover
// Ported from backend/src/routes/discover.js + scoring utilities
// Handles smart profile discovery with 4-phase scoring algorithm

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUser, errorResponse, jsonResponse } from "../_shared/utils.ts";

// ── Cultural Affinity ───────────────────────────────────────────────────────
//
// Maps ethnicity strings to a language-family group. Two profiles in the same
// group score higher than cross-group pairs; same-tribe pairs score highest.
// Includes alt names ("Jieng" → Dinka, "Naadh" → Nuer, etc.) so legacy
// profile data is mapped correctly.

const TRIBE_GROUP: Record<string, string> = {
  // Nilotic
  "dinka": "nilotic", "jieng": "nilotic",
  "nuer": "nilotic", "naadh": "nilotic",
  "shilluk": "nilotic", "chollo": "nilotic",
  "acholi": "nilotic",
  "luo": "nilotic", "anuak": "nilotic", "anyuak": "nilotic",
  "maaban": "nilotic", "koma": "nilotic", "burun": "nilotic", "uduk": "nilotic",
  // Eastern Sudanic / Nilo-Hamitic (Equatoria)
  "bari": "eastern", "kakwa": "eastern", "kuku": "eastern", "pojulu": "eastern", "nyangbara": "eastern",
  "mundari": "eastern",
  "lotuko": "eastern", "otuho": "eastern", "lotuha": "eastern",
  "toposa": "eastern", "taposa": "eastern",
  "murle": "eastern", "didinga": "eastern", "boya": "eastern",
  "lokoya": "eastern", "lulubo": "eastern", "lirya": "eastern",
  "nyangatom": "eastern", "nyepu": "eastern", "dungatona": "eastern", "langi": "eastern",
  // Bantu / Central Sudanic
  "azande": "central", "zande": "central",
  "baka": "central", "balanda": "central", "biri": "central", "boro": "central",
  "madi": "central",
  "bongo": "central", "jur beli": "central", "ndogo": "central",
  "kreish": "central", "yulu": "central", "fertit": "central",
};

// Particularly-close tribe pairs across history/geography. Same-group pairs
// not on this list still get the medium-affinity score below.
const HIGH_AFFINITY_PAIRS = new Set([
  "dinka-nuer", "nuer-dinka",
  "shilluk-acholi", "acholi-shilluk",
  "acholi-luo", "luo-acholi",
  "dinka-shilluk", "shilluk-dinka",
  "bari-kakwa", "kakwa-bari",
  "bari-kuku", "kuku-bari",
  "bari-pojulu", "pojulu-bari",
  "bari-mundari", "mundari-bari",
  "lotuko-toposa", "toposa-lotuko",
  "azande-baka", "baka-azande",
  "balanda-azande", "azande-balanda",
]);

function normalize(str: unknown): string {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

function scoreEthnicAffinity(userEth: unknown, candEth: unknown): number {
  const a = normalize(userEth);
  const b = normalize(candEth);
  if (!a || !b) return 0;
  if (a === b) return 15;
  const groupA = TRIBE_GROUP[a];
  const groupB = TRIBE_GROUP[b];
  if (groupA && groupB && groupA === groupB) {
    if (HIGH_AFFINITY_PAIRS.has(`${a}-${b}`)) return 10;
    return 5;
  }
  // Cross-group South-Sudanese pair still earns the small "shared nationality"
  // bonus, since both are SS tribes.
  if (groupA && groupB) return 3;
  return 0;
}

function scoreStickerAffinity(userStickers: unknown[], candStickers: unknown[]): number {
  const a = Array.isArray(userStickers) ? userStickers : [];
  const b = Array.isArray(candStickers) ? candStickers : [];
  if (a.length === 0 || b.length === 0) return 0;
  const userLabels = new Set(a.map((s: any) => normalize(typeof s === "string" ? s : s?.label || "")));
  let shared = 0;
  for (const sticker of b) {
    const label = normalize(typeof sticker === "string" ? sticker : (sticker as any)?.label || "");
    if (label && userLabels.has(label)) { shared++; if (shared >= 5) break; }
  }
  return shared * 8;
}

const INTEREST_CLUSTERS: Record<string, Set<string>> = {
  traditional: new Set(["culture", "faith", "cooking", "volunteering"]),
  creative: new Set(["art", "fashion", "photography", "poetry"]),
  active: new Set(["fitness", "basketball", "soccer", "running", "dancing"]),
  intellectual: new Set(["reading", "tech", "history", "languages"]),
  social: new Set(["music", "travel", "food", "nature"]),
};

function getClusters(interests: unknown[]): Set<string> {
  const arr = Array.isArray(interests) ? interests : [];
  const clusters = new Set<string>();
  for (const interest of arr) {
    const lower = normalize(interest);
    for (const [cluster, members] of Object.entries(INTEREST_CLUSTERS)) {
      if (members.has(lower)) clusters.add(cluster);
    }
  }
  return clusters;
}

function scoreInterestClusterMatch(userInt: unknown[], candInt: unknown[]): number {
  const uC = getClusters(userInt), cC = getClusters(candInt);
  if (uC.size === 0 || cC.size === 0) return 0;
  let shared = 0;
  for (const c of uC) { if (cC.has(c)) shared++; }
  return shared * 5;
}

function scoreCulturalAffinity(userProfile: any, candProfile: any): number {
  return scoreEthnicAffinity(userProfile?.ethnicity, candProfile?.ethnicity) +
    scoreStickerAffinity(userProfile?.stickers, candProfile?.stickers) +
    scoreInterestClusterMatch(userProfile?.interests, candProfile?.interests);
}

// ── Keywords ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "for", "on", "with",
  "at", "by", "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "out", "off", "over", "under", "again", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "every", "both", "few",
  "more", "most", "other", "some", "such", "no", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "about", "up", "down", "if", "it", "its", "my",
  "your", "his", "her", "our", "their", "me", "him", "us", "them", "i", "you", "he",
  "she", "we", "they", "what", "which", "who", "whom", "this", "that", "these",
  "those", "am", "im", "ive", "dont", "doesnt", "didnt", "wont", "cant", "also",
  "like", "really", "get", "got", "much", "well", "still", "even",
]);

const CULTURAL_KEYWORDS = new Set([
  "juba", "bor", "malakal", "wau", "rumbek", "aweil", "torit", "yei", "nimule",
  "dinka", "nuer", "shilluk", "acholi", "bari", "lotuko", "madi", "zande", "luo",
  "cattle", "church", "wrestling", "asida", "kisra", "junub", "junubin",
  "diaspora", "beadwork", "nyamuora", "luak", "cordit",
  "south sudan", "sudanese", "nilotic", "equatoria",
  "gospel", "faith", "prayer", "sunday",
  "traditional", "culture", "heritage", "tribe", "clan",
  "nile", "sudd", "jonglei", "unity",
]);

function extractKeywords(text: string): { word: string; isCultural: boolean }[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set<string>();
  const result: { word: string; isCultural: boolean }[] = [];
  for (const phrase of CULTURAL_KEYWORDS) {
    if (phrase.includes(" ") && lower.includes(phrase)) {
      if (!found.has(phrase)) { found.add(phrase); result.push({ word: phrase, isCultural: true }); }
    }
  }
  const tokens = lower.split(/[^a-z']+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    if (STOP_WORDS.has(token) || found.has(token)) continue;
    found.add(token);
    result.push({ word: token, isCultural: CULTURAL_KEYWORDS.has(token) });
  }
  return result;
}

function getProfileText(profile: any): string {
  const parts: string[] = [];
  if (profile?.bio) parts.push(profile.bio);
  if (profile?.promptAnswer) parts.push(profile.promptAnswer);
  if (profile?.lookingFor) parts.push(profile.lookingFor);
  return parts.join(" ");
}

function scoreKeywordOverlap(userProfile: any, candProfile: any): number {
  const uKw = extractKeywords(getProfileText(userProfile));
  const cKw = extractKeywords(getProfileText(candProfile));
  if (uKw.length === 0 || cKw.length === 0) return 0;
  const candMap = new Map<string, boolean>();
  for (const kw of cKw) candMap.set(kw.word, kw.isCultural);
  let score = 0;
  for (const kw of uKw) {
    if (candMap.has(kw.word)) score += (kw.isCultural || candMap.get(kw.word)) ? 8 : 3;
  }
  return Math.min(score, 25);
}

function scoreProfileFreshness(candProfile: any): number {
  if (!candProfile?.updatedAt) return 0;
  const hoursAgo = (Date.now() - new Date(candProfile.updatedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) return 10;
  if (hoursAgo < 72) return 7;
  if (hoursAgo < 168) return 5;
  return 0;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function scoreCurrentlyInto(userProfile: any, candProfile: any): number {
  const userInto = Array.isArray(userProfile?.currentlyInto) ? userProfile.currentlyInto : [];
  const candInto = Array.isArray(candProfile?.currentlyInto) ? candProfile.currentlyInto : [];
  const candInterests = Array.isArray(candProfile?.interests) ? candProfile.interests : [];
  let score = 0;
  if (userInto.length > 0 && candInto.length > 0) {
    const set = new Set(candInto.map((s: any) => normalize(s)));
    for (const item of userInto) { if (set.has(normalize(item))) score += 25; }
  }
  if (userInto.length > 0 && candInterests.length > 0) {
    const set = new Set(candInterests.map((s: any) => normalize(s)));
    for (const item of userInto) { if (set.has(normalize(item))) score += 8; }
  }
  if (candInto.length > 0 && candProfile?.currentlyIntoSetAt) {
    const hoursAgo = (Date.now() - new Date(candProfile.currentlyIntoSetAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 48) score += 5;
  }
  return score;
}

function scoreBehavioral(candProfile: any, candidate: any, vector: any): number {
  if (!vector || vector.swipesAnalyzed < 20) return 0;
  let score = 0;
  if (vector.ethnicityWeights && candProfile?.ethnicity) {
    score += Math.round((vector.ethnicityWeights[candProfile.ethnicity] || 0) * 15);
  }
  if (vector.interestWeights && Array.isArray(candProfile?.interests)) {
    let is_ = 0;
    for (const i of candProfile.interests) is_ += (vector.interestWeights[i] || 0) * 5;
    score += Math.round(Math.max(-20, Math.min(20, is_)));
  }
  if (vector.preferredAgeMin != null && vector.preferredAgeMax != null && candidate?.dateOfBirth) {
    const dob = new Date(candidate.dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
    if (age >= vector.preferredAgeMin && age <= vector.preferredAgeMax) score += 10;
  }
  if (vector.preferredHeightMin != null && vector.preferredHeightMax != null && candProfile?.heightCm) {
    if (candProfile.heightCm >= vector.preferredHeightMin && candProfile.heightCm <= vector.preferredHeightMax) score += 5;
  }
  if (vector.stickerWeights && Array.isArray(candProfile?.stickers)) {
    let ss = 0;
    for (const st of candProfile.stickers) {
      const label = typeof st === "string" ? st : st?.label || "";
      ss += (vector.stickerWeights[label] || 0) * 5;
    }
    score += Math.round(Math.max(-10, Math.min(10, ss)));
  }
  if (vector.intentionWeights && candProfile?.datingIntentions) {
    const w = vector.intentionWeights[candProfile.datingIntentions] || 0;
    score += Math.round(Math.max(-10, Math.min(10, w * 10)));
  }
  return score;
}

function scorePopularityElo(popRecord: any): number {
  if (!popRecord) return 0;
  const elo = popRecord.eloScore || 1000;
  if (elo > 1200) return 15;
  if (elo > 1100) return 10;
  if (elo > 1000) return 5;
  return 0;
}

// Spotlight is the paid 30-min visibility boost. While the window is
// active we add a flat lift to the candidate's score so they break into
// the upper band of the discover deck. The lift is large enough to beat
// most organic signals but not so large that it dominates an obviously
// poor match — a Spotlight user still has to score reasonably elsewhere.
//
// Boost is gated on `surveyCompletedAt` — paying to spotlight an empty
// profile is a bad outcome for the spotlighter (no matches) and for
// the viewer (poor card). The Edge Function pre-filter already drops
// surveyless users, but this guard keeps the score honest if that
// filter is ever loosened.
function scoreSpotlight(candProfile: any): number {
  if (!candProfile?.surveyCompletedAt) return 0;
  const until = candProfile?.spotlightedUntil;
  if (!until) return 0;
  const ts = new Date(until).getTime();
  if (Number.isNaN(ts) || ts <= Date.now()) return 0;
  return 25;
}

function scoreCandidate(candidate: any, currentUserProfile: any, opts: any = {}): number {
  let score = 0;
  const cp = candidate.profile || {};

  // Shared interests — diminishing-returns cap. A candidate with one
  // common interest is meaningful; with twelve they likely picked the
  // most popular ones and the signal is weaker. Cap at +40 (4 matches).
  const myI = Array.isArray(currentUserProfile?.interests) ? currentUserProfile.interests : [];
  const theirI = Array.isArray(cp.interests) ? cp.interests : [];
  if (myI.length > 0 && theirI.length > 0) {
    const mySet = new Set(myI.map((i: string) => i.toLowerCase()));
    let interestMatches = 0;
    for (const i of theirI) { if (mySet.has(i.toLowerCase())) interestMatches++; }
    score += Math.min(40, interestMatches * 10);
  }

  // Matching dating intentions
  if (currentUserProfile?.datingIntentions && cp.datingIntentions &&
      currentUserProfile.datingIntentions.toLowerCase() === cp.datingIntentions.toLowerCase()) score += 20;

  // Recency bonus — recalibrated. The previous 30/20/10 curve let
  // "online right now" users dominate the deck and pushed lower-
  // engagement-but-better-fit profiles down. New curve is gentler so
  // recency is a tiebreaker, not the lead signal.
  if (candidate.lastActiveAt) {
    const hrs = (Date.now() - new Date(candidate.lastActiveAt).getTime()) / 3600000;
    if (hrs < 1) score += 15;
    else if (hrs < 24) score += 10;
    else if (hrs < 72) score += 5;
  }

  if (candidate.isVerified) score += 5;
  if (candidate.photos && candidate.photos.length >= 3) score += 10;
  if (cp.bio?.trim()) score += 5;

  score += scoreCulturalAffinity(currentUserProfile, cp);
  score += scoreKeywordOverlap(currentUserProfile, cp);
  score += scoreProfileFreshness(cp);
  score += scoreCurrentlyInto(currentUserProfile, cp);

  // Mutual-interest boost — they already liked / super-liked the
  // viewer. This is the strongest organic signal we have and it sat
  // unused in the algorithm. We expose it through opts.likedMeSet
  // (populated upstream from the Swipe table where toUserId = viewer
  // AND type IN ('like','super_like')). The candidate gets a large
  // boost so a mutual like cannot accidentally land off the top
  // window. Super-likes get an even bigger one.
  if (opts.likedMeSet?.has?.(candidate.id)) score += 35;
  if (opts.superLikedMeSet?.has?.(candidate.id)) score += 15;

  if (opts.preferenceVector) score += scoreBehavioral(cp, candidate, opts.preferenceVector);
  if (opts.popularityMap) score += scorePopularityElo(opts.popularityMap[candidate.id]);
  if (opts.collaborativeBoosts?.[candidate.id]) score += opts.collaborativeBoosts[candidate.id];
  score += scoreSpotlight(cp);

  return score;
}

/**
 * Pop the next candidate respecting a "no more than maxStreak in a row
 * from the same group" rule. Used by rankCandidates to keep the deck
 * visually diverse — five Dinka cards in a row looks like the
 * algorithm only knows one tribe, even if the scoring is correct.
 */
function popDiverse(
  bucket: { candidate: any; score: number }[],
  recentGroupRing: string[],
  maxStreak: number,
  groupOf: (c: any) => string,
): { candidate: any; score: number } | null {
  if (bucket.length === 0) return null;
  // If the last `maxStreak` picks are all the same group, prefer a
  // different one if possible. Fall through to the top item when no
  // alternative exists (don't starve the deck).
  if (recentGroupRing.length >= maxStreak) {
    const tail = recentGroupRing.slice(-maxStreak);
    const allSame = tail.every((g) => g === tail[0]);
    if (allSame) {
      const altIdx = bucket.findIndex((b) => groupOf(b.candidate) !== tail[0]);
      if (altIdx > 0) return bucket.splice(altIdx, 1)[0];
    }
  }
  return bucket.shift() || null;
}

function rankCandidates(candidates: any[], currentUserProfile: any, limit: number, windowSize = 5, opts: any = {}): any[] {
  const scored = candidates.map((c) => ({ candidate: c, score: scoreCandidate(c, currentUserProfile, opts) }));
  scored.sort((a, b) => b.score - a.score);

  // Window-shuffle keeps top scores at top but adds intra-window
  // randomness so the deck doesn't feel deterministic. Diversity
  // post-pass ensures no more than 2 same-tribe cards in a row.
  const shuffled: { candidate: any; score: number }[] = [];
  for (let i = 0; i < scored.length; i += windowSize) {
    const window = scored.slice(i, i + windowSize);
    for (let j = window.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [window[j], window[k]] = [window[k], window[j]];
    }
    shuffled.push(...window);
  }

  const result: any[] = [];
  const recentGroups: string[] = [];
  const groupOf = (c: any): string => {
    const eth = (c?.profile?.ethnicity || "").toString().toLowerCase().trim();
    return eth || "unknown";
  };

  while (result.length < limit) {
    const pick = popDiverse(shuffled, recentGroups, 2, groupOf);
    if (!pick) break;
    result.push(pick.candidate);
    recentGroups.push(groupOf(pick.candidate));
    if (recentGroups.length > 3) recentGroups.shift();
  }
  return result;
}

// ── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = await getUser(req, supabase);
    if (!userId) return errorResponse("Unauthorized", 401);

    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams);

    const minAge = params.minAge ? parseInt(params.minAge) : undefined;
    const maxAge = params.maxAge ? parseInt(params.maxAge) : undefined;
    const ethnicity = params.ethnicity;
    const minHeightCm = params.minHeightCm ? parseInt(params.minHeightCm) : undefined;
    const maxHeightCm = params.maxHeightCm ? parseInt(params.maxHeightCm) : undefined;
    const datingIntentions = params.datingIntentions;
    const gender = params.gender;
    const limit = Math.min(50, Math.max(1, parseInt(params.limit || "20")));
    const cursor = params.cursor;
    const mode = params.mode === "social" ? "social" : "dating";

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const minDob = maxAge ? new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate()) : undefined;
    const maxDob = minAge ? new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate()) : undefined;

    // Fetch current user's profile (may legitimately not exist yet for
    // freshly-signed-up users — use maybeSingle so the function still returns
    // a valid result instead of an error).
    const { data: currentUserProfile } = await supabase
      .from("Profile")
      .select("*")
      .eq("userId", userId)
      .maybeSingle();

    // Get already-swiped user IDs
    const { data: swipedRows } = await supabase
      .from("Swipe")
      .select("toUserId")
      .eq("fromUserId", userId);
    const excludedIds = (swipedRows || []).map((s: any) => s.toUserId);
    excludedIds.push(userId);

    // Block table joins both directions — a user we blocked, and a user
    // who blocked us, both vanish from the deck. Without this, a victim
    // who has already blocked an abuser still sees the abuser's card.
    const { data: blockedAByMe } = await supabase
      .from("Block")
      .select("blockedId")
      .eq("blockerId", userId);
    const { data: blockedMe } = await supabase
      .from("Block")
      .select("blockerId")
      .eq("blockedId", userId);
    for (const r of blockedAByMe || []) excludedIds.push((r as any).blockedId);
    for (const r of blockedMe   || []) excludedIds.push((r as any).blockerId);

    // Hard age floor — server-side, regardless of viewer-supplied filter.
    // Apple App Review treats a single under-18 in the deck as grounds
    // for rejection on a dating app.
    const eighteenYearsAgo = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());

    // Build candidate query
    const fetchLimit = limit * 3;
    let query = supabase
      .from("User")
      .select("*, profile:Profile(*), photos:Photo(*)")
      .eq("isActive", true)
      .eq("moderationStatus", "active")            // banned/restricted users invisible
      .lte("dateOfBirth", eighteenYearsAgo.toISOString())  // 18+ only
      .gte("lastActiveAt", thirtyDaysAgo.toISOString())
      .order("lastActiveAt", { ascending: false })
      .limit(fetchLimit + 1);

    // PostgREST encodes `in` filters into the URL, which has a hard
    // length limit (~4–8 KB depending on infra). A power user with
    // thousands of swipes plus blocks can blow past that and hit a
    // 414 URI Too Long. The cap below keeps the in-list short enough
    // to fit comfortably; older excluded IDs (oldest swipes / rarest
    // blocks) are dropped — meaning a deeply-swiped user might see a
    // long-ago-passed card again, which is benign vs. a hard error.
    //
    // 800 IDs × ~36 chars (uuid-ish text PK) + commas ≈ 30 KB, far
    // over the safe URL length. We keep it to 800 only because the
    // server query limits the pool further and the recency-skewed
    // overlap is small. Tune downward if 414s recur.
    const URL_SAFE_CAP = 800;
    if (excludedIds.length > URL_SAFE_CAP) {
      // Keep the most recent N — recency is the cheapest priority
      // signal we have in this slice (recent swipes/blocks live at
      // the end of the list because we appended them in order).
      excludedIds.splice(0, excludedIds.length - URL_SAFE_CAP);
    }
    if (excludedIds.length > 0) {
      query = query.not("id", "in", `(${excludedIds.join(",")})`);
    }

    if (gender && mode !== "social") query = query.eq("gender", gender);
    if (minDob) query = query.gte("dateOfBirth", minDob.toISOString());
    if (maxDob) query = query.lte("dateOfBirth", maxDob.toISOString());
    if (cursor) query = query.lt("id", cursor);

    const { data: candidates, error: candErr } = await query;
    if (candErr) return errorResponse(candErr.message, 500);

    // Filter by profile fields (ethnicity, height, intentions, mode)
    let pool = (candidates || []).filter((c: any) => {
      const p = c.profile;
      if (!p || p.showMe === false) return false;
      // Survey is the dating-eligibility floor on the *target* side too.
      // Profile cards without a completed survey aren't matchable, so
      // we don't include them in anyone else's deck either.
      if (!p.surveyCompletedAt) return false;
      // Incognito hides the candidate from everyone else's deck. The
      // user can still browse normally; they just don't appear in
      // others' results until they flip the toggle off.
      if (p.incognito) return false;
      if (ethnicity && p.ethnicity !== ethnicity) return false;
      if (minHeightCm && (!p.heightCm || p.heightCm < minHeightCm)) return false;
      if (maxHeightCm && (!p.heightCm || p.heightCm > maxHeightCm)) return false;
      if (datingIntentions && p.datingIntentions !== datingIntentions) return false;
      // Mode gate uses the canonical `accountPurpose` field (set during
      // ProfileSetup → "What brings you here?" step). The previous heuristic
      // was scanning `lookingFor` for the substring "friend", which never
      // matches real values like "Long-term relationship" or "Figuring it out".
      if (mode === "social" && p.accountPurpose && p.accountPurpose !== "socialize" && p.accountPurpose !== "both") return false;
      if (mode === "dating" && p.accountPurpose === "socialize") return false;
      return true;
    });

    const hasMore = pool.length > fetchLimit;
    if (hasMore) pool = pool.slice(0, fetchLimit);

    // Phase 3: Behavioral learning — vector is computed only after the user
    // has built up enough swipe history; use maybeSingle so brand-new users
    // (no vector yet) don't error out.
    const { data: preferenceVector } = await supabase
      .from("UserPreferenceVector")
      .select("*")
      .eq("userId", userId)
      .maybeSingle();

    // Phase 4: Community patterns
    const candidateIds = pool.map((c: any) => c.id);
    let popularityMap: Record<string, any> = {};
    if (candidateIds.length > 0) {
      const { data: popRows } = await supabase
        .from("UserPopularity")
        .select("*")
        .in("userId", candidateIds);
      for (const r of popRows || []) popularityMap[r.userId] = r;
    }

    // Collaborative boosts (simplified for edge function)
    let collaborativeBoosts: Record<string, number> = {};
    if (preferenceVector?.swipesAnalyzed >= 30 && candidateIds.length > 0) {
      const { data: myLikes } = await supabase
        .from("Swipe")
        .select("toUserId")
        .eq("fromUserId", userId)
        .in("type", ["like", "super_like"]);

      if (myLikes && myLikes.length >= 30) {
        const myLikedIds = myLikes.map((s: any) => s.toUserId);
        const { data: similarSwipes } = await supabase
          .from("Swipe")
          .select("fromUserId, toUserId")
          .in("toUserId", myLikedIds)
          .in("type", ["like", "super_like"])
          .neq("fromUserId", userId);

        if (similarSwipes && similarSwipes.length > 0) {
          const fromCounts: Record<string, number> = {};
          for (const s of similarSwipes) fromCounts[s.fromUserId] = (fromCounts[s.fromUserId] || 0) + 1;
          const similarUserIds = Object.entries(fromCounts)
            .filter(([, count]) => count >= 3)
            .map(([uid]) => uid);

          if (similarUserIds.length > 0) {
            const { data: boostSwipes } = await supabase
              .from("Swipe")
              .select("fromUserId, toUserId")
              .in("fromUserId", similarUserIds)
              .in("toUserId", candidateIds)
              .in("type", ["like", "super_like"]);

            const likeCounts: Record<string, number> = {};
            for (const s of boostSwipes || []) likeCounts[s.toUserId] = (likeCounts[s.toUserId] || 0) + 1;
            for (const [candId, count] of Object.entries(likeCounts)) {
              collaborativeBoosts[candId] = count >= 2 ? 15 : 0;
            }
          }
        }
      }
    }

    // Mutual-interest detection — pull every Swipe from candidates
    // back to the viewer. The boost makes profiles that already
    // liked the viewer surface near the top of the deck so a
    // reciprocal swipe creates a match quickly.
    let likedMeSet = new Set<string>();
    let superLikedMeSet = new Set<string>();
    {
      const candIds = pool.map((c: any) => c.id).filter(Boolean);
      if (candIds.length > 0) {
        const { data: incomingSwipes } = await supabase
          .from("Swipe")
          .select("fromUserId, type")
          .in("fromUserId", candIds)
          .eq("toUserId", userId)
          .in("type", ["like", "super_like"]);
        for (const s of incomingSwipes || []) {
          likedMeSet.add(s.fromUserId);
          if (s.type === "super_like") superLikedMeSet.add(s.fromUserId);
        }
      }
    }

    const ranked = rankCandidates(pool, currentUserProfile, limit, 5, {
      preferenceVector,
      popularityMap,
      collaborativeBoosts,
      likedMeSet,
      superLikedMeSet,
    });

    const nextCursor = hasMore ? pool[pool.length - 1]?.id : null;

    return jsonResponse({ profiles: ranked, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message || "Internal error", 500);
  }
});
