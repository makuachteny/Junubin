/**
 * detect-scam-signal — flag conversations that match romance-scam
 * patterns (off-platform redirect, early money ask, love-bombing).
 *
 * Deterministic, heuristic-only. (An optional LLM scoring path was
 * removed — JuNubin does not use AI. Detection is now a pure regex
 * weighting over recent incoming messages.) Response schema:
 *
 *   { risk: "low" | "medium" | "high",
 *     confidence: 0..1,
 *     signals: string[],
 *     message: string }
 *
 * Auth: end-user JWT. The function only scores conversations the
 * caller is a member of.
 *
 * Request body: { conversationId: string }
 * Response: SignalVerdict
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse, getUser } from "../_shared/utils.ts";
import { captureException } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Heuristic prefilter — even with no AI provider configured we can
// catch the lowest-hanging signals via regex on the recent message
// history. These map to the most-common romance-scam phrasings 2026
// trust-and-safety teams flag.
const FAST_SIGNALS: { id: string; pattern: RegExp; weight: number }[] = [
  { id: "off-platform-whatsapp",     pattern: /\bwhats?app\b/i,                            weight: 0.35 },
  { id: "off-platform-telegram",     pattern: /\btelegram\b/i,                             weight: 0.45 },
  { id: "off-platform-email",        pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/,                  weight: 0.30 },
  { id: "money-gift-card",           pattern: /\b(gift\s?card|google\s?play|itunes)\b/i,   weight: 0.60 },
  { id: "money-wire",                pattern: /\b(wire\s?(transfer)?|western\s?union|moneygram)\b/i, weight: 0.65 },
  { id: "money-crypto",              pattern: /\b(bitcoin|btc|usdt|ethereum|crypto)\b/i,   weight: 0.55 },
  { id: "love-bombing",              pattern: /\b(my (queen|king|soulmate)|i('?| a)?m in love|destiny brought)\b/i, weight: 0.25 },
  { id: "emergency-cash",            pattern: /\b(stuck (in|at)|emergency|please help|hospital bill)\b/i, weight: 0.40 },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const userId = await getUser(req, supabase);
    if (!userId) return errorResponse("Unauthorized", 401);

    const { conversationId } = await req.json();
    if (!conversationId) return errorResponse("conversationId required");

    // Membership check — caller must be in the conversation.
    const { data: member } = await supabase
      .from("ConversationMember")
      .select("conversationId")
      .eq("conversationId", conversationId)
      .eq("userId", userId)
      .maybeSingle();
    if (!member) return errorResponse("Forbidden", 403);

    // Pull the last 30 messages (chronological), excluding the
    // caller's own messages — we're scoring incoming behavior, not
    // self-grading.
    const { data: messages } = await supabase
      .from("Message")
      .select("senderId, body, createdAt")
      .eq("conversationId", conversationId)
      .neq("senderId", userId)
      .order("createdAt", { ascending: false })
      .limit(30);
    const recent = (messages || []).reverse();

    // Regex prefilter — works without any AI provider.
    const hits: { id: string; weight: number }[] = [];
    for (const msg of recent) {
      const text = String(msg.body || "");
      for (const sig of FAST_SIGNALS) {
        if (sig.pattern.test(text)) {
          hits.push({ id: sig.id, weight: sig.weight });
        }
      }
    }
    const baseRisk = Math.min(1, hits.reduce((sum, h) => sum + h.weight, 0));
    const uniqueSignals = Array.from(new Set(hits.map((h) => h.id)));

    // Deterministic, regex-only verdict. Risk bands: >0.6 high, >0.3
    // medium, else low. (The previous LLM scoring path was removed.)
    const risk = baseRisk > 0.6 ? "high" : baseRisk > 0.3 ? "medium" : "low";
    const message =
      risk === "high"
        ? "These messages match common romance-scam patterns. Be careful with money requests and moving off the app."
        : risk === "medium"
          ? "Some messages match patterns worth a second look. Never send money or move off-platform with someone you just met."
          : uniqueSignals.length
            ? "Some patterns flagged but not high-risk in isolation."
            : "No scam signals detected.";

    return jsonResponse({
      risk,
      confidence: baseRisk,
      signals: uniqueSignals,
      message,
    });
  } catch (err) {
    console.error("[detect-scam-signal] error:", err);
    await captureException(err, { fn: "detect-scam-signal" });
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
