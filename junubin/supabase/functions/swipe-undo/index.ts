// Edge Function: swipe-undo
// Reverses the most recent swipe between (fromUserId, toUserId) for the
// authenticated user. Powers the JuNubin+ Rewind action: deletes the
// Swipe row, rolls back Elo + popularity counters, and (if a Match was
// created by this swipe AND no messages have been exchanged yet) tears
// down the Match + Conversation so the recipient never sees a like
// that was undone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUser, errorResponse, jsonResponse } from "../_shared/utils.ts";

const ELO_K_FACTOR = 32;

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

    const { toUserId } = await req.json();
    if (!toUserId) return errorResponse("toUserId required", 400);

    // Fetch the swipe so we know its type (drives the Elo rollback).
    const { data: swipe } = await supabase
      .from("Swipe")
      .select("id, type")
      .eq("fromUserId", userId)
      .eq("toUserId", toUserId)
      .maybeSingle();

    if (!swipe) {
      return jsonResponse({ ok: true, undone: false, reason: "no_swipe" });
    }

    // If the swipe produced a match, only tear it down when neither
    // user has sent a message yet — once people start chatting, the
    // match is real and an undo shouldn't silently delete the thread.
    if (swipe.type === "like" || swipe.type === "super_like") {
      const pairKey = makePairKey(userId, toUserId);
      const { data: match } = await supabase
        .from("Match")
        .select("id, conversation:Conversation(id)")
        .eq("pairKey", pairKey)
        .maybeSingle();

      if (match) {
        const convId = (match as any).conversation?.id || (match as any).conversation?.[0]?.id;
        const { count: messageCount } = convId
          ? await supabase
              .from("Message")
              .select("id", { count: "exact", head: true })
              .eq("conversationId", convId)
          : { count: 0 } as any;

        if ((messageCount || 0) === 0) {
          if (convId) {
            await supabase.from("ConversationMember").delete().eq("conversationId", convId);
            await supabase.from("Conversation").delete().eq("id", convId);
          }
          await supabase.from("Match").delete().eq("id", match.id);

          // Decrement match counters for both users.
          for (const uid of [userId, toUserId]) {
            const { data: pop } = await supabase
              .from("UserPopularity")
              .select("totalMatches")
              .eq("userId", uid)
              .maybeSingle();
            if (pop) {
              await supabase
                .from("UserPopularity")
                .update({ totalMatches: Math.max(0, (pop.totalMatches || 0) - 1) })
                .eq("userId", uid);
            }
          }
        } else {
          // Match has activity — refuse the undo so we don't break a
          // live conversation. Client treats this as a no-op.
          return jsonResponse({ ok: true, undone: false, reason: "match_active" });
        }
      }
    }

    // Roll back Elo + receipt counters before deleting the row.
    await rollbackElo(supabase, userId, toUserId, swipe.type);

    await supabase.from("Swipe").delete().eq("id", swipe.id);

    return jsonResponse({ ok: true, undone: true });
  } catch (err: any) {
    return errorResponse(err.message || "Internal error", 500);
  }
});

async function rollbackElo(
  supabase: any,
  fromUserId: string,
  toUserId: string,
  swipeType: string,
) {
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

  let likesDelta = 0;
  let passesDelta = 0;
  let superLikesDelta = 0;
  if (swipeType === "like") {
    likesDelta = -1;
  } else if (swipeType === "super_like") {
    likesDelta = -1;
    superLikesDelta = -1;
  } else if (swipeType === "pass") {
    passesDelta = -1;
  }

  // Reverse the Elo change that the original swipe applied.
  const expected = expectedScore(toPop.eloScore, fromPop.eloScore);
  const oldActual = swipeType === "like" || swipeType === "super_like" ? 1 : 0;
  const eloChange = -1 * ELO_K_FACTOR * (oldActual - expected);

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
