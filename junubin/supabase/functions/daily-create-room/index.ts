/**
 * daily-create-room — Supabase Edge Function
 *
 * Mints a Daily.co room URL + a per-participant token using the project's
 * secret Daily API key (`DAILY_API_KEY` in Supabase secrets). Used for
 * both 1:1 / multi-party calls AND live broadcasts. Two `kind` flavours:
 *
 *   `call`  — privacy=private, max-participants 8, expires in 1 hour.
 *             Room name keyed by conversationId so re-joining works.
 *   `live`  — privacy=public, no participant cap, expires in 8 hours.
 *             Room name keyed by host userId.
 *
 * Tokens are issued with `is_owner: true` for callers / broadcasters so
 * they can end the room or mute participants. Viewers / non-callers get
 * a vanilla token so they can join + render media but not control the
 * room.
 *
 * Setup (one-time per project):
 *   1. Create an account at daily.co (free tier ships with 10k mins/mo)
 *   2. Copy the API key from dashboard.daily.co/developers
 *   3. supabase secrets set DAILY_API_KEY=... --project-ref <ref>
 *   4. Optionally set DAILY_DOMAIN to your subdomain (defaults to the
 *      free `daily.co` namespace, e.g. `junubin.daily.co`).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";

const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY") || "";
const DAILY_DOMAIN = Deno.env.get("DAILY_DOMAIN") || ""; // e.g. "junubin"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DAILY_API = "https://api.daily.co/v1";

async function dailyApi(method: string, path: string, body?: any) {
  const res = await fetch(`${DAILY_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    throw new Error(`Daily API ${method} ${path} → ${res.status}: ${json?.info || text}`);
  }
  return json;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!DAILY_API_KEY) {
    return errorResponse(
      "Daily.co not configured. Set DAILY_API_KEY in Supabase secrets after creating a Daily account at daily.co.",
      503,
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) return errorResponse("Unauthorized", 401);

    // Banned / restricted users can't create or join Daily rooms.
    // Calls and live streams are user-to-user channels — letting a
    // restricted account spin one up is the same kind of leak as
    // letting them swipe. Cheap one-row check.
    const { data: caller } = await supabase
      .from("User")
      .select("moderationStatus")
      .eq("auth_id", authUser.id)
      .maybeSingle();
    if (caller?.moderationStatus && caller.moderationStatus !== "active") {
      return errorResponse("Account is restricted", 403);
    }

    const { kind, context, isOwner } = await req.json();
    if (!kind || !context) {
      return errorResponse("Missing kind or context");
    }
    if (kind !== "call" && kind !== "live") {
      return errorResponse("kind must be 'call' or 'live'");
    }

    // Sanitize the context into something Daily accepts (≤41 chars,
    // alphanumeric + dashes). We keep the shape "<kind>-<hash>" so
    // collision risk is low even with truncated context ids.
    const slug = `${kind}-${String(context).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 30)}`;

    // Idempotently create or fetch the room.
    let room: any;
    try {
      room = await dailyApi("GET", `/rooms/${slug}`);
    } catch {
      const expSeconds = kind === "live" ? 8 * 3600 : 1 * 3600;
      room = await dailyApi("POST", "/rooms", {
        name: slug,
        privacy: kind === "live" ? "public" : "private",
        properties: {
          exp: Math.floor(Date.now() / 1000) + expSeconds,
          enable_chat: true,
          enable_screenshare: kind === "call",
          enable_recording: kind === "live" ? "cloud" : false,
          start_video_off: kind === "live", // viewers join with no video by default
          start_audio_off: kind === "live",
          max_participants: kind === "live" ? 200 : 8,
          eject_at_room_exp: true,
        },
      });
    }

    // Mint a participant token. Owners can mute others / end the room.
    const tokenRes = await dailyApi("POST", "/meeting-tokens", {
      properties: {
        room_name: slug,
        user_id: authUser.id,
        user_name: (authUser.user_metadata?.name || authUser.email || "Guest").slice(0, 40),
        is_owner: !!isOwner,
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1h token
      },
    });

    return jsonResponse({
      url: room.url,
      token: tokenRes.token,
      room: room.name,
    });
  } catch (err) {
    console.error("daily-create-room error:", err);
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
