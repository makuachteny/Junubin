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
    const { toUserId, type, whisper: rawWhisper } = body;

    if (!toUserId || !["like", "pass", "super_like"].includes(type)) {
      return errorResponse("Invalid payload: toUserId and type (like|pass|super_like) required", 400);
    }
    if (toUserId === userId) {
      return errorResponse("Cannot swipe yourself", 400);
    }
    // Whisper is only meaningful on a like/super_like; ignore on pass.
    // Trim + cap to the same 280-char ceiling the column constraint
    // enforces so we never round-trip and 23514.
    const whisper =
      typeof rawWhisper === "string" && (type === "like" || type === "super_like")
        ? rawWhisper.trim().slice(0, 280) || null
        : null;

    // ── Safety gates ────────────────────────────────────────────────
    // The discover Edge Function already filters out users we'd refuse
    // to write a swipe against, but the swipe endpoint accepts a raw
    // toUserId from the client — a tampered or stale client could try
    // to swipe past those filters. Re-check on every write.

    // 1. Caller's own moderation status. Banned/restricted users can't
    //    swipe at all (and shouldn't even reach this endpoint, since
    //    AuthContext force-signs-out banned users — defensive).
    const { data: callerSafety } = await supabase
      .from("User")
      .select(`moderationStatus, profile:Profile(surveyCompletedAt, accountPurpose)`)
      .eq("id", userId)
      .maybeSingle();
    if (!callerSafety) return errorResponse("User not found", 404);
    if (callerSafety.moderationStatus && callerSafety.moderationStatus !== "active") {
      return errorResponse("Account is restricted", 403);
    }

    // 2. Dating-mode actions require a completed survey. Pass
    //    (left-swipe) is allowed without survey so users can browse
    //    the deck while filling in their profile.
    if ((type === "like" || type === "super_like")) {
      const profile = (callerSafety as any).profile;
      const purpose = profile?.accountPurpose;
      const isDatingPath = purpose === "dating" || purpose === "both" || !purpose; // default: dating
      if (isDatingPath && !profile?.surveyCompletedAt) {
        return errorResponse("survey_required", 403);
      }
    }

    // 3. Verify target user exists AND is not blocked in either
    //    direction. A swipe write between blocked users is a no-op and
    //    a leak (the swipe row would exist; reciprocal-detection logic
    //    could surface a phantom match).
    const { data: targetUser } = await supabase
      .from("User")
      .select("id, moderationStatus")
      .eq("id", toUserId)
      .maybeSingle();
    if (!targetUser) return errorResponse("User not found", 404);
    if (targetUser.moderationStatus && targetUser.moderationStatus !== "active") {
      return errorResponse("User not found", 404); // intentionally vague
    }

    const { data: blockRows } = await supabase
      .from("Block")
      .select("id")
      .or(
        `and(blockerId.eq.${userId},blockedId.eq.${toUserId}),` +
        `and(blockerId.eq.${toUserId},blockedId.eq.${userId})`,
      );
    if (blockRows && blockRows.length > 0) {
      return errorResponse("Action not allowed", 403);
    }

    // Enforce daily like limit for free users
    if (type === "like" || type === "super_like") {
      const { data: currentUser } = await supabase
        .from("User")
        .select("subscriptionTier, promoTier, promoEndsAt")
        .eq("id", userId)
        .maybeSingle();

      const baseTier = currentUser?.subscriptionTier || "free";
      const tierRank: Record<string, number> = { free: 0, plus: 1, junub: 2 };
      const promoActive =
        currentUser?.promoTier &&
        currentUser?.promoEndsAt &&
        new Date(currentUser.promoEndsAt).getTime() > Date.now();
      const promoTier = currentUser?.promoTier || "free";
      const tier =
        promoActive && (tierRank[promoTier] > tierRank[baseTier]) ? promoTier : baseTier;
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

    // Read the previous swipe (if any) so we know whether this is a brand-new
    // swipe vs. an undo/change. We use maybeSingle — the row may not exist.
    const { data: prevSwipe } = await supabase
      .from("Swipe")
      .select("id, type")
      .eq("fromUserId", userId)
      .eq("toUserId", toUserId)
      .maybeSingle();

    const prevType = prevSwipe?.type || null;

    // Upsert atomically against the unique (fromUserId, toUserId) index.
    // Avoids the select-then-insert race where two concurrent requests would
    // both INSERT and the second one would 23505 with no recovery.
    // `whisper` is only set when the swipe carries one — re-swiping the
    // same user without a new whisper preserves the existing value
    // rather than wiping it.
    const upsertRow: Record<string, unknown> = { fromUserId: userId, toUserId, type };
    if (whisper !== null) upsertRow.whisper = whisper;
    await supabase
      .from("Swipe")
      .upsert(upsertRow, { onConflict: "fromUserId,toUserId" });

    // Update Elo / receipt counters with the OLD type → NEW type delta. If the
    // type didn't change, this is a no-op — no double counting.
    if (prevType !== type) {
      updateElo(supabase, userId, toUserId, type, prevType).catch(() => {});
    }

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
        .maybeSingle();

      if (reciprocal) {
        const pairKey = makePairKey(userId, toUserId);
        const userAId = [userId, toUserId].sort()[0];
        const userBId = [userId, toUserId].sort()[1];

        // Try INSERT first; on 23505 (the Match_pairKey_key unique
        // constraint already exists from a concurrent swipe) fall through to
        // a re-fetch. Single round-trip on the happy path.
        let newMatch = null;
        const { data: insertResult, error: insertErr } = await supabase
          .from("Match")
          .insert({ pairKey, userAId, userBId })
          .select("*")
          .maybeSingle();
        newMatch = insertResult;

        if (insertErr || !newMatch) {
          const { data: existingMatch } = await supabase
            .from("Match")
            .select("*, conversation:Conversation(*)")
            .eq("pairKey", pairKey)
            .maybeSingle();
          if (existingMatch) {
            match = existingMatch;
          }
        } else {
          // Create conversation
          const { data: conv } = await supabase
            .from("Conversation")
            .insert({ matchId: newMatch.id })
            .select("*")
            .maybeSingle();

          if (conv) {
            // Add both users as members. Use upsert so a partial insert
            // (one row landed before a retry) doesn't leave us with a duplicate.
            await supabase
              .from("ConversationMember")
              .upsert(
                [
                  { conversationId: conv.id, userId },
                  { conversationId: conv.id, userId: toUserId },
                ],
                { onConflict: "conversationId,userId" },
              );

            match = { ...newMatch, conversation: conv };
          }

          // Fire-and-forget: increment match count
          incrementMatchCount(supabase, userId, toUserId).catch(() => {});
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

async function updateElo(
  supabase: any,
  fromUserId: string,
  toUserId: string,
  swipeType: string,
  prevType: string | null = null,
) {
  // Ensure both users have popularity records
  for (const uid of [fromUserId, toUserId]) {
    const { data } = await supabase
      .from("UserPopularity")
      .select("id")
      .eq("userId", uid)
      .maybeSingle();
    if (!data) await supabase.from("UserPopularity").insert({ userId: uid });
  }

  const { data: fromPop } = await supabase
    .from("UserPopularity")
    .select("*")
    .eq("userId", fromUserId)
    .maybeSingle();
  const { data: toPop } = await supabase
    .from("UserPopularity")
    .select("*")
    .eq("userId", toUserId)
    .maybeSingle();
  if (!fromPop || !toPop) return;

  // Compute counter deltas. If prevType is null this is a brand-new swipe; if
  // prevType is set it's an undo / change, and we both decrement the previous
  // bucket and increment the new one — net no double counting.
  let likesDelta = 0;
  let passesDelta = 0;
  let superLikesDelta = 0;

  const bump = (t: string, sign: 1 | -1) => {
    if (t === "like") {
      likesDelta += sign;
    } else if (t === "super_like") {
      likesDelta += sign;
      superLikesDelta += sign;
    } else if (t === "pass") {
      passesDelta += sign;
    }
  };
  if (prevType) bump(prevType, -1);
  bump(swipeType, +1);

  // Elo: only revise score on the diff. For a brand-new swipe, apply the full
  // K-factor adjustment. For a flip (pass→like or like→pass), reverse the old
  // adjustment first, then apply the new — net effect = 2*K*(actual-expected),
  // capturing the change in sentiment.
  const expected = expectedScore(toPop.eloScore, fromPop.eloScore);
  const newActual = swipeType === "like" || swipeType === "super_like" ? 1 : 0;
  let eloChange = ELO_K_FACTOR * (newActual - expected);
  if (prevType) {
    const oldActual = prevType === "like" || prevType === "super_like" ? 1 : 0;
    eloChange -= ELO_K_FACTOR * (oldActual - expected);
  }

  const newLikes = Math.max(0, (toPop.totalLikesReceived || 0) + likesDelta);
  const newPasses = Math.max(0, (toPop.totalPassesReceived || 0) + passesDelta);
  const newSuperLikes = Math.max(0, (toPop.totalSuperLikes || 0) + superLikesDelta);
  const total = newLikes + newPasses;

  await supabase.from("UserPopularity").update({
    eloScore: toPop.eloScore + eloChange,
    totalLikesReceived: newLikes,
    totalPassesReceived: newPasses,
    totalSuperLikes: newSuperLikes,
    likeRatio: total > 0 ? newLikes / total : 0,
    lastComputedAt: new Date().toISOString(),
  }).eq("userId", toUserId);
}

// ── Background: increment match count ───────────────────────────────────────

async function incrementMatchCount(supabase: any, userAId: string, userBId: string) {
  for (const uid of [userAId, userBId]) {
    const { data } = await supabase
      .from("UserPopularity")
      .select("*")
      .eq("userId", uid)
      .maybeSingle();
    if (data) {
      await supabase.from("UserPopularity").update({ totalMatches: (data.totalMatches || 0) + 1 }).eq("userId", uid);
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
    .maybeSingle();

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
    .maybeSingle();

  if (existing) {
    await supabase.from("UserPreferenceVector").update(vectorData).eq("userId", userId);
  } else {
    await supabase.from("UserPreferenceVector").insert(vectorData);
  }
}
