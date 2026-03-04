// Edge Function: swipe
// Ported from backend/src/routes/swipes.js
// Handles swipe creation, match detection, Elo updates, preference vector recomputation

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUser, errorResponse, jsonResponse } from "../_shared/utils.ts";

const FREE_DAILY_LIKE_LIMIT = 25;
const ELO_K_FACTOR = 32;
const MIN_SWIPES_FOR_VECTOR = 20;

function makePairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = await getUser(req, supabase);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const { toUserId, type } = body;

    if (!toUserId || !["like", "pass", "super_like"].includes(type)) {
      return errorResponse("Invalid payload: toUserId and type (like|pass|super_like) required", 400);
    }
    if (toUserId === userId) {
      return errorResponse("Cannot swipe yourself", 400);
    }

    // Verify target user exists
    const { data: targetUser } = await supabase
      .from("User")
      .select("id")
      .eq("id", toUserId)
      .single();
    if (!targetUser) return errorResponse("User not found", 404);

    // Enforce daily like limit for free users
    if (type === "like" || type === "super_like") {
      const { data: currentUser } = await supabase
        .from("User")
        .select("subscriptionTier")
        .eq("id", userId)
        .single();

      const tier = currentUser?.subscriptionTier || "free";
      if (tier === "free") {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("Swipe")
          .select("id", { count: "exact", head: true })
          .eq("fromUserId", userId)
          .in("type", ["like", "super_like"])
          .gte("createdAt", startOfDay.toISOString());

        if ((count || 0) >= FREE_DAILY_LIKE_LIMIT) {
          return jsonResponse({
            error: "daily_limit",
            message: "Daily like limit reached",
            used: count,
            limit: FREE_DAILY_LIKE_LIMIT,
            remaining: 0,
          }, 429);
        }
      }
    }

    // Upsert swipe
    const { data: existingSwipe } = await supabase
      .from("Swipe")
      .select("id")
      .eq("fromUserId", userId)
      .eq("toUserId", toUserId)
      .single();

    if (existingSwipe) {
      await supabase
        .from("Swipe")
        .update({ type })
        .eq("id", existingSwipe.id);
    } else {
      await supabase
        .from("Swipe")
        .insert({ fromUserId: userId, toUserId, type });
    }

    // Fire-and-forget: update Elo scores
    updateElo(supabase, userId, toUserId, type).catch(() => {});

    // Fire-and-forget: recompute preference vector if stale
    recomputeVectorIfStale(supabase, userId).catch(() => {});

    // Check for match on like/super_like
    let match = null;
    if (type === "like" || type === "super_like") {
      const { data: reciprocal } = await supabase
        .from("Swipe")
        .select("id, type")
        .eq("fromUserId", toUserId)
        .eq("toUserId", userId)
        .in("type", ["like", "super_like"])
        .single();

      if (reciprocal) {
        const pairKey = makePairKey(userId, toUserId);
        const userAId = [userId, toUserId].sort()[0];
        const userBId = [userId, toUserId].sort()[1];

        // Check if match already exists
        const { data: existingMatch } = await supabase
          .from("Match")
          .select("*, conversation:Conversation(*)")
          .eq("pairKey", pairKey)
          .single();

        if (existingMatch) {
          match = existingMatch;
        } else {
          // Create match
          const { data: newMatch } = await supabase
            .from("Match")
            .insert({ pairKey, userAId, userBId })
            .select("*")
            .single();

          if (newMatch) {
            // Create conversation
            const { data: conv } = await supabase
              .from("Conversation")
              .insert({ matchId: newMatch.id })
              .select("*")
              .single();

            if (conv) {
              // Add both users as members
              await supabase
                .from("ConversationMember")
                .insert([
                  { conversationId: conv.id, userId },
                  { conversationId: conv.id, userId: toUserId },
                ]);

              match = { ...newMatch, conversation: conv };
            }

            // Fire-and-forget: increment match count
            incrementMatchCount(supabase, userId, toUserId).catch(() => {});
          }
        }
      }
    }

    // Return daily status with response
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: usedToday } = await supabase
      .from("Swipe")
      .select("id", { count: "exact", head: true })
      .eq("fromUserId", userId)
      .in("type", ["like", "super_like"])
      .gte("createdAt", startOfDay.toISOString());

    return jsonResponse({
      ok: true,
      match,
      dailyStatus: {
        used: usedToday || 0,
        limit: FREE_DAILY_LIKE_LIMIT,
        remaining: Math.max(0, FREE_DAILY_LIKE_LIMIT - (usedToday || 0)),
      },
    }, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Internal error", 500);
  }
});

// ── Background: Elo update ──────────────────────────────────────────────────

async function updateElo(supabase: any, fromUserId: string, toUserId: string, swipeType: string) {
  // Ensure both users have popularity records
  for (const uid of [fromUserId, toUserId]) {
    const { data } = await supabase.from("UserPopularity").select("id").eq("userId", uid).single();
    if (!data) await supabase.from("UserPopularity").insert({ userId: uid });
  }

  const { data: fromPop } = await supabase.from("UserPopularity").select("*").eq("userId", fromUserId).single();
  const { data: toPop } = await supabase.from("UserPopularity").select("*").eq("userId", toUserId).single();
  if (!fromPop || !toPop) return;

  const isPositive = swipeType === "like" || swipeType === "super_like";
  const expected = expectedScore(toPop.eloScore, fromPop.eloScore);
  const actual = isPositive ? 1 : 0;
  const newElo = toPop.eloScore + ELO_K_FACTOR * (actual - expected);

  const updateData: any = {
    eloScore: newElo,
    lastComputedAt: new Date().toISOString(),
  };
  if (swipeType === "like") {
    updateData.totalLikesReceived = toPop.totalLikesReceived + 1;
  } else if (swipeType === "super_like") {
    updateData.totalLikesReceived = toPop.totalLikesReceived + 1;
    updateData.totalSuperLikes = toPop.totalSuperLikes + 1;
  } else {
    updateData.totalPassesReceived = toPop.totalPassesReceived + 1;
  }

  await supabase.from("UserPopularity").update(updateData).eq("userId", toUserId);

  // Recompute likeRatio
  const { data: updated } = await supabase.from("UserPopularity").select("*").eq("userId", toUserId).single();
  if (updated) {
    const total = updated.totalLikesReceived + updated.totalPassesReceived;
    if (total > 0) {
      await supabase.from("UserPopularity")
        .update({ likeRatio: updated.totalLikesReceived / total })
        .eq("userId", toUserId);
    }
  }
}

// ── Background: increment match count ───────────────────────────────────────

async function incrementMatchCount(supabase: any, userAId: string, userBId: string) {
  for (const uid of [userAId, userBId]) {
    const { data } = await supabase.from("UserPopularity").select("*").eq("userId", uid).single();
    if (data) {
      await supabase.from("UserPopularity").update({ totalMatches: data.totalMatches + 1 }).eq("userId", uid);
    } else {
      await supabase.from("UserPopularity").insert({ userId: uid, totalMatches: 1 });
    }
  }
}

// ── Background: preference vector ───────────────────────────────────────────

async function recomputeVectorIfStale(supabase: any, userId: string) {
  const { data: existing } = await supabase
    .from("UserPreferenceVector")
    .select("*")
    .eq("userId", userId)
    .single();

  const { count: totalSwipes } = await supabase
    .from("Swipe")
    .select("id", { count: "exact", head: true })
    .eq("fromUserId", userId);

  if (!existing) {
    if ((totalSwipes || 0) >= MIN_SWIPES_FOR_VECTOR) {
      await computePreferenceVector(supabase, userId);
    }
    return;
  }

  const newSwipes = (totalSwipes || 0) - existing.swipesAnalyzed;
  if (newSwipes >= 10) {
    await computePreferenceVector(supabase, userId);
  }
}

async function computePreferenceVector(supabase: any, userId: string) {
  const { data: swipes } = await supabase
    .from("Swipe")
    .select("type, toUserId")
    .eq("fromUserId", userId);

  if (!swipes || swipes.length < MIN_SWIPES_FOR_VECTOR) return;

  // Get all swiped user profiles
  const toUserIds = swipes.map((s: any) => s.toUserId);
  const { data: users } = await supabase
    .from("User")
    .select("id, dateOfBirth, profile:Profile(*)")
    .in("id", toUserIds);

  const userMap: Record<string, any> = {};
  for (const u of users || []) userMap[u.id] = u;

  const liked = swipes.filter((s: any) => s.type === "like" || s.type === "super_like");
  const passed = swipes.filter((s: any) => s.type === "pass");
  const total = swipes.length;

  // Ethnicity weights
  const ethCounts = { liked: {} as Record<string, number>, passed: {} as Record<string, number> };
  for (const s of liked) {
    const eth = userMap[s.toUserId]?.profile?.ethnicity;
    if (eth) ethCounts.liked[eth] = (ethCounts.liked[eth] || 0) + 1;
  }
  for (const s of passed) {
    const eth = userMap[s.toUserId]?.profile?.ethnicity;
    if (eth) ethCounts.passed[eth] = (ethCounts.passed[eth] || 0) + 1;
  }
  const allEth = new Set([...Object.keys(ethCounts.liked), ...Object.keys(ethCounts.passed)]);
  const ethnicityWeights: Record<string, number> = {};
  for (const eth of allEth) {
    ethnicityWeights[eth] = Math.max(-1, Math.min(1, ((ethCounts.liked[eth] || 0) - (ethCounts.passed[eth] || 0)) / total));
  }

  // Interest weights
  const intCounts = { liked: {} as Record<string, number>, passed: {} as Record<string, number> };
  for (const s of liked) {
    const interests = userMap[s.toUserId]?.profile?.interests;
    if (Array.isArray(interests)) for (const i of interests) intCounts.liked[i] = (intCounts.liked[i] || 0) + 1;
  }
  for (const s of passed) {
    const interests = userMap[s.toUserId]?.profile?.interests;
    if (Array.isArray(interests)) for (const i of interests) intCounts.passed[i] = (intCounts.passed[i] || 0) + 1;
  }
  const allInt = new Set([...Object.keys(intCounts.liked), ...Object.keys(intCounts.passed)]);
  const interestWeights: Record<string, number> = {};
  for (const i of allInt) {
    interestWeights[i] = Math.max(-1, Math.min(1, ((intCounts.liked[i] || 0) - (intCounts.passed[i] || 0)) / total));
  }

  // Age preferences
  let preferredAgeMin = null, preferredAgeMax = null;
  const now = new Date();
  const likedAges: number[] = [];
  for (const s of liked) {
    const dob = userMap[s.toUserId]?.dateOfBirth;
    if (dob) {
      const d = new Date(dob);
      let age = now.getFullYear() - d.getFullYear();
      if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
      likedAges.push(age);
    }
  }
  if (likedAges.length >= 5) {
    likedAges.sort((a, b) => a - b);
    preferredAgeMin = likedAges[Math.floor(likedAges.length * 0.1)];
    preferredAgeMax = likedAges[Math.floor(likedAges.length * 0.9)];
  }

  // Height preferences
  let preferredHeightMin = null, preferredHeightMax = null;
  const likedHeights: number[] = [];
  for (const s of liked) {
    const h = userMap[s.toUserId]?.profile?.heightCm;
    if (h) likedHeights.push(h);
  }
  if (likedHeights.length >= 5) {
    likedHeights.sort((a, b) => a - b);
    preferredHeightMin = likedHeights[Math.floor(likedHeights.length * 0.1)];
    preferredHeightMax = likedHeights[Math.floor(likedHeights.length * 0.9)];
  }

  // Sticker weights
  const stCounts = { liked: {} as Record<string, number>, passed: {} as Record<string, number> };
  for (const s of liked) {
    const stickers = userMap[s.toUserId]?.profile?.stickers;
    if (Array.isArray(stickers)) for (const st of stickers) {
      const label = typeof st === "string" ? st : st?.label || "";
      if (label) stCounts.liked[label] = (stCounts.liked[label] || 0) + 1;
    }
  }
  for (const s of passed) {
    const stickers = userMap[s.toUserId]?.profile?.stickers;
    if (Array.isArray(stickers)) for (const st of stickers) {
      const label = typeof st === "string" ? st : st?.label || "";
      if (label) stCounts.passed[label] = (stCounts.passed[label] || 0) + 1;
    }
  }
  const allSt = new Set([...Object.keys(stCounts.liked), ...Object.keys(stCounts.passed)]);
  const stickerWeights: Record<string, number> = {};
  for (const st of allSt) {
    stickerWeights[st] = Math.max(-1, Math.min(1, ((stCounts.liked[st] || 0) - (stCounts.passed[st] || 0)) / total));
  }

  // Intention weights
  const intntCounts = { liked: {} as Record<string, number>, passed: {} as Record<string, number> };
  for (const s of liked) {
    const intent = userMap[s.toUserId]?.profile?.datingIntentions;
    if (intent) intntCounts.liked[intent] = (intntCounts.liked[intent] || 0) + 1;
  }
  for (const s of passed) {
    const intent = userMap[s.toUserId]?.profile?.datingIntentions;
    if (intent) intntCounts.passed[intent] = (intntCounts.passed[intent] || 0) + 1;
  }
  const allIntnt = new Set([...Object.keys(intntCounts.liked), ...Object.keys(intntCounts.passed)]);
  const intentionWeights: Record<string, number> = {};
  for (const intent of allIntnt) {
    intentionWeights[intent] = Math.max(-1, Math.min(1, ((intntCounts.liked[intent] || 0) - (intntCounts.passed[intent] || 0)) / total));
  }

  const vectorData = {
    userId,
    ethnicityWeights,
    interestWeights,
    preferredAgeMin,
    preferredAgeMax,
    preferredHeightMin,
    preferredHeightMax,
    stickerWeights,
    intentionWeights,
    swipesAnalyzed: total,
    lastComputedAt: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("UserPreferenceVector")
    .select("id")
    .eq("userId", userId)
    .single();

  if (existing) {
    await supabase.from("UserPreferenceVector").update(vectorData).eq("userId", userId);
  } else {
    await supabase.from("UserPreferenceVector").insert(vectorData);
  }
}
