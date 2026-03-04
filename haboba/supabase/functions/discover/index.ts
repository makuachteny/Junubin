// Edge Function: discover
// Ported from backend/src/routes/discover.js + scoring utilities
// Handles smart profile discovery with 4-phase scoring algorithm

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUser, errorResponse, jsonResponse } from "../_shared/utils.ts";

// ── Cultural Affinity ───────────────────────────────────────────────────────

const NILOTIC = ["Dinka", "Nuer", "Shilluk", "Acholi", "Luo"];
const EQUATORIAN = ["Bari", "Lotuko", "Madi"];

const NILOTIC_AFFINITY: Record<string, Record<string, number>> = {};
for (const a of NILOTIC) {
  NILOTIC_AFFINITY[a] = {};
  for (const b of NILOTIC) {
    if (a === b) continue;
    const highPairs = [
      "Dinka-Nuer", "Nuer-Dinka",
      "Shilluk-Acholi", "Acholi-Shilluk",
      "Acholi-Luo", "Luo-Acholi",
      "Dinka-Shilluk", "Shilluk-Dinka",
    ];
    NILOTIC_AFFINITY[a][b] = highPairs.includes(`${a}-${b}`) ? 0.7 : 0.5;
  }
}

const EQUATORIAN_AFFINITY: Record<string, Record<string, number>> = {};
for (const a of EQUATORIAN) {
  EQUATORIAN_AFFINITY[a] = {};
  for (const b of EQUATORIAN) {
    if (a === b) continue;
    EQUATORIAN_AFFINITY[a][b] = ["Bari-Lotuko", "Lotuko-Bari"].includes(`${a}-${b}`) ? 0.7 : 0.5;
  }
}

const NILOTIC_SET = new Set(NILOTIC.map((g) => g.toLowerCase()));
const EQUATORIAN_SET = new Set(EQUATORIAN.map((g) => g.toLowerCase()));

function normalize(str: unknown): string {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

function titleCase(str: string): string {
  const s = normalize(str);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function scoreEthnicAffinity(userEth: unknown, candEth: unknown): number {
  const a = normalize(userEth);
  const b = normalize(candEth);
  if (!a || !b) return 0;
  if (a === b) return 15;
  const aT = titleCase(a), bT = titleCase(b);
  if (NILOTIC_SET.has(a) && NILOTIC_SET.has(b)) {
    const aff = NILOTIC_AFFINITY[aT]?.[bT] || 0.4;
    if (aff >= 0.6) return 10;
    if (aff >= 0.4) return 5;
  }
  if (EQUATORIAN_SET.has(a) && EQUATORIAN_SET.has(b)) {
    const aff = EQUATORIAN_AFFINITY[aT]?.[bT] || 0.4;
    if (aff >= 0.6) return 10;
    if (aff >= 0.4) return 5;
  }
  return 2;
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

function scoreCandidate(candidate: any, currentUserProfile: any, opts: any = {}): number {
  let score = 0;
  const cp = candidate.profile || {};

  // Shared interests
  const myI = Array.isArray(currentUserProfile?.interests) ? currentUserProfile.interests : [];
  const theirI = Array.isArray(cp.interests) ? cp.interests : [];
  if (myI.length > 0 && theirI.length > 0) {
    const mySet = new Set(myI.map((i: string) => i.toLowerCase()));
    for (const i of theirI) { if (mySet.has(i.toLowerCase())) score += 10; }
  }

  // Matching dating intentions
  if (currentUserProfile?.datingIntentions && cp.datingIntentions &&
      currentUserProfile.datingIntentions.toLowerCase() === cp.datingIntentions.toLowerCase()) score += 20;

  // Recency bonus
  if (candidate.lastActiveAt) {
    const hrs = (Date.now() - new Date(candidate.lastActiveAt).getTime()) / 3600000;
    if (hrs < 1) score += 30; else if (hrs < 24) score += 20; else if (hrs < 72) score += 10;
  }

  if (candidate.isVerified) score += 5;
  if (candidate.photos && candidate.photos.length >= 3) score += 10;
  if (cp.bio?.trim()) score += 5;

  score += scoreCulturalAffinity(currentUserProfile, cp);
  score += scoreKeywordOverlap(currentUserProfile, cp);
  score += scoreProfileFreshness(cp);
  score += scoreCurrentlyInto(currentUserProfile, cp);

  if (opts.preferenceVector) score += scoreBehavioral(cp, candidate, opts.preferenceVector);
  if (opts.popularityMap) score += scorePopularityElo(opts.popularityMap[candidate.id]);
  if (opts.collaborativeBoosts?.[candidate.id]) score += opts.collaborativeBoosts[candidate.id];

  return score;
}

function rankCandidates(candidates: any[], currentUserProfile: any, limit: number, windowSize = 5, opts: any = {}): any[] {
  const scored = candidates.map((c) => ({ candidate: c, score: scoreCandidate(c, currentUserProfile, opts) }));
  scored.sort((a, b) => b.score - a.score);
  const result: any[] = [];
  for (let i = 0; i < scored.length; i += windowSize) {
    const window = scored.slice(i, i + windowSize);
    for (let j = window.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [window[j], window[k]] = [window[k], window[j]];
    }
    result.push(...window);
  }
  return result.slice(0, limit).map((item) => item.candidate);
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

    // Fetch current user's profile
    const { data: currentUserProfile } = await supabase
      .from("Profile")
      .select("*")
      .eq("userId", userId)
      .single();

    // Get already-swiped user IDs
    const { data: swipedRows } = await supabase
      .from("Swipe")
      .select("toUserId")
      .eq("fromUserId", userId);
    const excludedIds = (swipedRows || []).map((s: any) => s.toUserId);
    excludedIds.push(userId);

    // Build candidate query
    const fetchLimit = limit * 3;
    let query = supabase
      .from("User")
      .select("*, profile:Profile(*), photos:Photo(*)")
      .eq("isActive", true)
      .gte("lastActiveAt", thirtyDaysAgo.toISOString())
      .not("id", "in", `(${excludedIds.join(",")})`)
      .order("lastActiveAt", { ascending: false })
      .limit(fetchLimit + 1);

    if (gender && mode !== "social") query = query.eq("gender", gender);
    if (minDob) query = query.gte("dateOfBirth", minDob.toISOString());
    if (maxDob) query = query.lte("dateOfBirth", maxDob.toISOString());
    if (cursor) query = query.lt("id", cursor);

    const { data: candidates, error: candErr } = await query;
    if (candErr) return errorResponse(candErr.message, 500);

    // Filter by profile fields (ethnicity, height, intentions, social mode)
    let pool = (candidates || []).filter((c: any) => {
      const p = c.profile;
      if (!p || p.showMe === false) return false;
      if (ethnicity && p.ethnicity !== ethnicity) return false;
      if (minHeightCm && (!p.heightCm || p.heightCm < minHeightCm)) return false;
      if (maxHeightCm && (!p.heightCm || p.heightCm > maxHeightCm)) return false;
      if (datingIntentions && p.datingIntentions !== datingIntentions) return false;
      if (mode === "social" && p.lookingFor && !p.lookingFor.toLowerCase().includes("friend")) return false;
      return true;
    });

    const hasMore = pool.length > fetchLimit;
    if (hasMore) pool = pool.slice(0, fetchLimit);

    // Phase 3: Behavioral learning
    const { data: preferenceVector } = await supabase
      .from("UserPreferenceVector")
      .select("*")
      .eq("userId", userId)
      .single();

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

    const ranked = rankCandidates(pool, currentUserProfile, limit, 5, {
      preferenceVector,
      popularityMap,
      collaborativeBoosts,
    });

    const nextCursor = hasMore ? pool[pool.length - 1]?.id : null;

    return jsonResponse({ profiles: ranked, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message || "Internal error", 500);
  }
});
