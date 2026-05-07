/**
 * push-send — Supabase Edge Function
 *
 * Fans out a push notification to one or more user ids via the Expo
 * Push API (https://exp.host/--/api/v2/push/send). Doesn't require any
 * Apple/Google credentials of its own — Expo's tokens already encode the
 * platform routing. Free tier is generous (~600 notifications/sec) and
 * doesn't need an access token for the basic flow.
 *
 * Request body:
 *   userIds: string[]    — JuNubin User.id values
 *   title: string        — push title
 *   body: string         — push body
 *   data?: object        — JSON payload, deep-link routing key like { type: 'match', match }
 *
 * The DB triggers in 00013_push_triggers.sql call this function via
 * pg_net for the standard cases (match, message, follow). It's also
 * invokable directly from any Edge Function or client (with the
 * service role key) for ad-hoc sends (e.g. campaign blasts).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
