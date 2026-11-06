/**
 * moderate-image — image moderation gate for user-uploaded media.
 *
 * Called by the post / story / profile-photo flows after an upload
 * lands in Storage. Returns one of:
 *
 *   { verdict: "approved", labels: [] }
 *   { verdict: "flagged",  labels: [...], reason: "..." }
 *   { verdict: "rejected", labels: [...], reason: "..." }
 *
 * The provider is selected via env var:
 *
 *   MODERATION_PROVIDER = aws | google | sightengine | none
 *
 * `none` is the default: the function returns { verdict: "approved" }
 * without calling anything. This lets the rest of the pipeline ship
 * before the operator wires a provider, with the trade-off that no
 * actual moderation happens. App Review will catch this — set a real
 * provider before the public TestFlight roll.
 *
 * Required env vars per provider:
 *   aws:        AWS_REKOGNITION_KEY_ID, AWS_REKOGNITION_SECRET, AWS_REGION
 *   google:     GOOGLE_VISION_API_KEY
 *   sightengine: SIGHTENGINE_USER, SIGHTENGINE_SECRET
 *
 * Request body: { imageUrl: string, postId?: string, kind?: 'post'|'story'|'photo' }
 * postId is optional; if present the function also writes the verdict
 * back to the Post.moderationStatus + moderationVerdict columns so the
 * Community feed can hide rejected rows immediately.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";
import { captureException } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PROVIDER     = (Deno.env.get("MODERATION_PROVIDER") || "none").toLowerCase();
// Environment posture. App.config.js distinguishes development /
// preview / production via APP_VARIANT for the client; the Edge
// Function side mirrors that with an env secret set at deploy time.
// We accept EITHER `NODE_ENV` or `ENVIRONMENT` because the operator
// runbook (docs/production-readiness) historically instructed
// `supabase secrets set ENVIRONMENT=production` while the code read
// NODE_ENV — a naming mismatch that silently disabled this fail-closed
// guard. Reading both closes that hole: whichever the operator sets,
// production is detected. Any non-development env that selects
// PROVIDER=none is treated as a misconfiguration — the function refuses
// rather than silently auto-approving every photo. May 2026 audit P0.5.
const NODE_ENV     = (Deno.env.get("NODE_ENV") || Deno.env.get("ENVIRONMENT") || "development").toLowerCase();
const IS_PROD_LIKE = NODE_ENV !== "development" && NODE_ENV !== "test";

// Confidence thresholds. Any label above REJECT_AT auto-rejects; labels
// in the [FLAG_AT, REJECT_AT) band need human review.
const REJECT_AT = 80;
const FLAG_AT   = 50;

const HARD_NO_LABELS = new Set([
  "Explicit Nudity", "Sexual Activity", "Graphic Violence Or Gore",
  "Visually Disturbing", "Hate Symbols", "CSAM",
]);
const SOFT_FLAG_LABELS = new Set([
  "Suggestive", "Female Swimwear Or Underwear", "Male Swimwear Or Underwear",
  "Violence", "Drugs", "Tobacco", "Alcohol", "Gambling",
]);

interface Verdict {
  verdict: "approved" | "flagged" | "rejected";
  labels: { name: string; confidence: number }[];
  reason?: string;
}

async function moderateNone(): Promise<Verdict> {
  return { verdict: "approved", labels: [] };
}

async function moderateGoogle(imageUrl: string): Promise<Verdict> {
  const key = Deno.env.get("GOOGLE_VISION_API_KEY");
  if (!key) throw new Error("GOOGLE_VISION_API_KEY not set");
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
          features: [{ type: "SAFE_SEARCH_DETECTION" }],
        }],
      }),
    },
  );
  if (!res.ok) throw new Error(`Vision API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const ss = data?.responses?.[0]?.safeSearchAnnotation || {};
  // Vision's likelihood enum → our 0..100 scale.
  const score = (val: string) => ({ VERY_UNLIKELY: 5, UNLIKELY: 25, POSSIBLE: 55, LIKELY: 80, VERY_LIKELY: 95 }[val] ?? 0);
  const labels = [
    { name: "Adult",    confidence: score(ss.adult || "") },
    { name: "Violence", confidence: score(ss.violence || "") },
    { name: "Racy",     confidence: score(ss.racy || "") },
    { name: "Medical",  confidence: score(ss.medical || "") },
    { name: "Spoof",    confidence: score(ss.spoof || "") },
  ];
  const worst = labels.reduce((a, b) => b.confidence > a.confidence ? b : a, labels[0]);
  if (worst.confidence >= REJECT_AT && (worst.name === "Adult" || worst.name === "Violence")) {
    return { verdict: "rejected", labels, reason: `${worst.name} ${worst.confidence}` };
  }
  if (worst.confidence >= FLAG_AT) {
    return { verdict: "flagged", labels, reason: `${worst.name} ${worst.confidence}` };
  }
  return { verdict: "approved", labels };
}

async function moderateSightengine(imageUrl: string): Promise<Verdict> {
  const user   = Deno.env.get("SIGHTENGINE_USER");
  const secret = Deno.env.get("SIGHTENGINE_SECRET");
  if (!user || !secret) throw new Error("Sightengine creds not set");
  const params = new URLSearchParams({
    url: imageUrl,
    models: "nudity-2.0,wad,offensive,gore",
    api_user: user, api_secret: secret,
  });
  const res = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`);
  if (!res.ok) throw new Error(`Sightengine ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const labels = [
    { name: "Nudity raw",   confidence: Math.round((data?.nudity?.raw || 0) * 100) },
    { name: "Nudity partial", confidence: Math.round((data?.nudity?.partial || 0) * 100) },
    { name: "Weapon",       confidence: Math.round((data?.weapon || 0) * 100) },
    { name: "Drug",         confidence: Math.round((data?.drugs || 0) * 100) },
    { name: "Offensive",    confidence: Math.round((data?.offensive?.prob || 0) * 100) },
    { name: "Gore",         confidence: Math.round((data?.gore?.prob || 0) * 100) },
  ];
  const worst = labels.reduce((a, b) => b.confidence > a.confidence ? b : a, labels[0]);
  if (worst.confidence >= REJECT_AT) return { verdict: "rejected", labels, reason: `${worst.name} ${worst.confidence}` };
  if (worst.confidence >= FLAG_AT)   return { verdict: "flagged", labels, reason: `${worst.name} ${worst.confidence}` };
  return { verdict: "approved", labels };
}

// AWS Rekognition Moderation Labels — needs SigV4 signing which is
// non-trivial to inline. Operators using AWS should call this Edge
// Function from a Lambda or use a pre-signed URL flow. For now, fail
// loud if AWS is selected without an upstream proxy.
async function moderateAws(imageUrl: string): Promise<Verdict> {
  const proxy = Deno.env.get("AWS_REKOGNITION_PROXY_URL");
  if (!proxy) {
    throw new Error("AWS provider requires AWS_REKOGNITION_PROXY_URL");
  }
  const res = await fetch(proxy, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  });
  if (!res.ok) throw new Error(`AWS proxy ${res.status}`);
  const { ModerationLabels = [] } = await res.json();
  const labels = ModerationLabels.map((l: any) => ({
    name: l.Name, confidence: Math.round(l.Confidence || 0),
  }));
  const hardHit = labels.find((l: any) => HARD_NO_LABELS.has(l.name) && l.confidence >= REJECT_AT);
  if (hardHit) return { verdict: "rejected", labels, reason: `${hardHit.name} ${hardHit.confidence}` };
  const softHit = labels.find((l: any) => SOFT_FLAG_LABELS.has(l.name) && l.confidence >= FLAG_AT);
  if (softHit) return { verdict: "flagged", labels, reason: `${softHit.name} ${softHit.confidence}` };
  return { verdict: "approved", labels };
}

async function moderate(imageUrl: string): Promise<Verdict> {
  switch (PROVIDER) {
    case "google":      return moderateGoogle(imageUrl);
    case "sightengine": return moderateSightengine(imageUrl);
    case "aws":         return moderateAws(imageUrl);
    case "none":
    default:            return moderateNone();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Fail-closed in production-like envs ────────────────────────────
  // The previous default — PROVIDER = "none" → auto-approve — meant a
  // deploy with no provider configured silently turned moderation off.
  // For a dating app shipping in 2026 the cost of one un-moderated
  // explicit image landing on the feed is far higher than the cost of
  // a hard error. Refuse the request loudly so the operator notices.
  if (IS_PROD_LIKE && PROVIDER === "none") {
    console.error(
      "[moderate-image] MODERATION_PROVIDER=none in production. Refusing to auto-approve.",
    );
    return errorResponse(
      "Moderation provider not configured. Set MODERATION_PROVIDER to aws|google|sightengine.",
      503,
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const { imageUrl, postId, photoId, kind } = body || {};
    if (!imageUrl || typeof imageUrl !== "string") {
      return errorResponse("imageUrl required");
    }

    let verdict: Verdict;
    try {
      verdict = await moderate(imageUrl);
    } catch (e) {
      // Fail-closed for dating media: if the provider is configured but
      // the call failed, we can't promise the image is safe, so we mark
      // it pending and let a human sweep. Only the `none` path returns
      // approved without a check.
      console.error("moderation provider failed", e);
      verdict = { verdict: "flagged", labels: [], reason: "provider_unavailable" };
    }

    const checkedAt = new Date().toISOString();

    if (postId && kind === "post") {
      await supabase
        .from("Post")
        .update({
          moderationStatus: verdict.verdict === "approved" ? "approved" : verdict.verdict === "rejected" ? "rejected" : "pending",
          moderationVerdict: verdict,
          moderationCheckedAt: checkedAt,
        })
        .eq("id", postId);
    }

    // Profile photos (00050). Until this branch existed the caller in
    // profileService.uploadPhoto fired the request and dropped the
    // answer on the floor, so a rejected profile photo stayed live.
    //
    // Unlike Post, we keep the provider's own three-way verdict rather
    // than collapsing flagged into pending: Photo's read paths hide
    // 'rejected' only, and preserving 'flagged' is what makes the
    // human-review queue (Photo_moderation_review_idx) meaningful.
    if (photoId && kind === "photo") {
      const { error: photoErr } = await supabase
        .from("Photo")
        .update({
          moderationStatus: verdict.verdict,
          moderationVerdict: verdict,
          moderationCheckedAt: checkedAt,
        })
        .eq("id", photoId);
      // Surface rather than swallow: a write failure here means a photo
      // is live with no verdict recorded, which is exactly the silent
      // gap this branch exists to close.
      if (photoErr) {
        console.error("[moderate-image] Photo verdict write failed", photoId, photoErr.message);
        await captureException(new Error(`Photo verdict write failed: ${photoErr.message}`), {
          fn: "moderate-image", photoId,
        });
      }
    }

    return jsonResponse(verdict);
  } catch (err) {
    console.error("moderate-image error:", err);
    await captureException(err, { fn: "moderate-image", provider: PROVIDER });
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
