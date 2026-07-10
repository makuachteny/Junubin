/**
 * push-send — Supabase Edge Function
 *
 * Fans out a push notification to one or more user ids via the Expo
 * Push API (https://exp.host/--/api/v2/push/send). Doesn't require any
 * Apple/Google credentials of its own — Expo's tokens already encode the
 * platform routing. Free tier is generous (~600 notifications/sec) and
 * doesn't need an access token for the basic flow.
 *
 * ── Authorization model ───────────────────────────────────────────────
 * Two callers are legitimate, and each authenticates differently:
 *
 *   1. `pg_net` from DB triggers (00013_push_triggers.sql). These run
 *      under the service role and stamp every request with the
 *      X-Junubin-Internal-Secret header set to JUNUBIN_INTERNAL_SECRET.
 *      Internal callers may target any user ids.
 *
 *   2. An authenticated client (regular user JWT) calling this function
 *      directly. The Supabase platform validates the JWT before the
 *      handler runs (no `verify_jwt = false` override in config.toml).
 *      End-user callers are restricted to sending to themselves only —
 *      e.g. a client-initiated "you have unread chats" reminder. Cross-
 *      user sends from a user JWT are denied (403) to close the push-
 *      spam primitive flagged in the audit.
 *
 * Request body: { userIds: string[], title, body, data? }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";
import { captureException } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const INTERNAL_SECRET = Deno.env.get("JUNUBIN_INTERNAL_SECRET") || "";

/**
 * Constant-time string compare. Avoids leaking the secret one
 * character at a time via response-timing differences.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns the caller's User.id when the request carries a valid
 * Authorization header for a real end user, or null otherwise. Used to
 * scope cross-user sends.
 */
async function resolveCallerUserId(req: Request, supabase: any): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: authUser } } = await supabase.auth.getUser(token);
  if (!authUser) return null;
  const { data: appUser } = await supabase
    .from("User")
    .select("id")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  return appUser?.id || null;
}

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

async function sendExpoPushBatch(messages: ExpoPushMessage[]) {
  if (!messages.length) return { tickets: [] };
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expo push API ${res.status}: ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { userIds, title, body, data } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return errorResponse("userIds must be a non-empty array");
    }
    if (!title && !body) {
      return errorResponse("title or body required");
    }

    // ── Authorization ───────────────────────────────────────────────
    // Path A: internal caller — either presents the JUNUBIN_INTERNAL_SECRET
    // header OR presents the service-role JWT as Bearer (this is how
    // pg_net from 00013_push_triggers.sql is configured today).
    // Path B: end-user caller is restricted to sending to themselves
    // only — they cannot weaponize this function to push to arbitrary
    // users.
    const internalHeader = req.headers.get("X-Junubin-Internal-Secret") || "";
    const bearerToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const isInternalHeader =
      INTERNAL_SECRET.trim().length > 0 &&
      constantTimeEqual(internalHeader, INTERNAL_SECRET);
    const isInternalServiceRole =
      SUPABASE_SERVICE_KEY.length > 0 &&
      bearerToken.length > 0 &&
      constantTimeEqual(bearerToken, SUPABASE_SERVICE_KEY);
    const isInternal = isInternalHeader || isInternalServiceRole;

    if (!isInternal) {
      const callerUserId = await resolveCallerUserId(req, supabase);
      if (!callerUserId) {
        return errorResponse("Unauthorized", 401);
      }
      // End-user callers may only target themselves. Filter the list
      // rather than rejecting outright so the client doesn't crash on a
      // mixed payload, but flag in the response so we can spot abuse
      // attempts in logs.
      const filtered = userIds.filter((id: string) => id === callerUserId);
      if (filtered.length === 0) {
        return errorResponse("Forbidden: cross-user push denied", 403);
      }
      if (filtered.length !== userIds.length) {
        console.warn(
          "[push-send] dropped cross-user targets from non-internal caller",
          { callerUserId, requested: userIds.length, kept: filtered.length },
        );
      }
      // Mutate the working list — downstream code uses `userIds` directly.
      userIds.length = 0;
      for (const id of filtered) userIds.push(id);
    }

    // Resolve push tokens. Skip rows with no token (user hasn't granted
    // notifications yet) so the function is a no-op for them rather than
    // erroring out on the trigger.
    const { data: rows, error } = await supabase
      .from("User")
      .select("id, pushToken")
      .in("id", userIds)
      .not("pushToken", "is", null);
    if (error) throw error;

    const messages: ExpoPushMessage[] = (rows || [])
      .filter((r: any) => r.pushToken && r.pushToken.startsWith("ExponentPushToken"))
      .map((r: any) => ({
        to: r.pushToken,
        title: title || "JuNubin",
        body: body || "",
        data: data || {},
        sound: "default",
        priority: "high",
        channelId: "default",
      }));

    if (messages.length === 0) {
      return jsonResponse({ sent: 0, reason: "No valid push tokens" });
    }

    // Expo recommends batches of ≤100. We're way under that for typical
    // match/message events but handle the chunking generally. Tickets
    // and the messages they correspond to are zipped so we can null out
    // any pushTokens Expo tells us are dead.
    const BATCH = 100;
    const tickets: any[] = [];
    const deadTokens = new Set<string>();
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      const res = await sendExpoPushBatch(batch);
      const batchTickets = res.data || res || [];
      tickets.push(...batchTickets);
      // Each ticket aligns with the message at the same index. If Expo
      // says the device is gone we strip the token from User so future
      // sends don't waste Expo's quota and don't surface ghost pushes.
      batch.forEach((msg, idx) => {
        const t = batchTickets[idx];
        if (t && t.status === "error") {
          const code = t.details?.error;
          if (code === "DeviceNotRegistered" || code === "InvalidCredentials") {
            deadTokens.add(msg.to);
          }
        }
      });
    }

    if (deadTokens.size > 0) {
      // Best-effort cleanup. We don't fail the request on this — the
      // pushes that did succeed are already out, and the next send to
      // the same dead tokens will just hit this branch again if we
      // can't update right now.
      try {
        await supabase
          .from("User")
          .update({ pushToken: null })
          .in("pushToken", Array.from(deadTokens));
      } catch (e) {
        console.warn("push-send: could not null dead tokens", e);
      }
    }

    return jsonResponse({
      sent: messages.length,
      tickets,
      cleanedTokens: deadTokens.size,
    });
  } catch (err) {
    console.error("push-send error:", err);
    await captureException(err, { fn: "push-send" });
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
