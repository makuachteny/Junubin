/**
 * face-liveness — AWS Rekognition Face Liveness session scaffold.
 *
 * This is the server-side glue for active liveness verification.
 * Replaces the old "single selfie + manual admin review" path with a
 * real liveness session: the client SDK records a short video stream
 * proving the user is physically present (head-turn / blink), Amazon
 * Rekognition scores it, and we mirror the result onto User.isVerified
 * (via the existing 00029 VerificationRequest trigger).
 *
 * ── Status ──────────────────────────────────────────────────────────
 * Scaffolded but inert until AWS credentials are wired. While
 * AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are unset,
 * this function returns 503 so the client falls back to the legacy
 * selfie-upload flow. Wiring is intentionally separated from PRD-level
 * UX decisions (do we *require* liveness for swipes? show a badge?).
 *
 * ── Request shapes ──────────────────────────────────────────────────
 * POST { action: "create" }   → { sessionId, region }
 * POST { action: "result", sessionId }   → { confidence, status }
 *
 * The two-call shape mirrors AWS's CreateFaceLivenessSession /
 * GetFaceLivenessSessionResults split. The client SDK
 * (@aws-amplify/ui-react-native FaceLivenessDetector) consumes the
 * sessionId, drives the camera flow, and the client calls back here
 * with action=result to read the score.
 *
 * ── Configuration ───────────────────────────────────────────────────
 * Env: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 *      LIVENESS_PASS_THRESHOLD (default 75)
 *
 * The threshold mirrors AWS's recommended "high confidence" floor for
 * dating-style use cases.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";
import { captureException } from "../_shared/sentry.ts";
import { signAwsRequest } from "../_shared/aws-sigv4.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const AWS_REGION = Deno.env.get("AWS_REGION") || "";
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID") || "";
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY") || "";
const PASS_THRESHOLD = Number(Deno.env.get("LIVENESS_PASS_THRESHOLD") || "75");

function awsConfigured(): boolean {
  return !!(AWS_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY);
}

/**
 * Resolve the authenticated User row from the Authorization header.
 * Same pattern stripe-create-checkout uses.
 */
async function authenticatedUser(req: Request, supabase: any): Promise<{ authId: string; userId: string } | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: { user: authUser } } = await supabase.auth.getUser(token);
  if (!authUser) return null;
  const { data } = await supabase
    .from("User")
    .select("id, auth_id")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  return data ? { authId: data.auth_id, userId: data.id } : null;
}

/**
 * Call a Rekognition AWS JSON 1.1 RPC. Centralizes the SigV4 + envelope
 * concerns so the two operations stay small.
 */
async function callRekognition(operation: string, payload: Record<string, unknown>): Promise<any> {
  const url = `https://rekognition.${AWS_REGION}.amazonaws.com/`;
  const body = JSON.stringify(payload);
  const baseHeaders = {
    "Content-Type": "application/x-amz-json-1.1",
    "X-Amz-Target": `RekognitionService.${operation}`,
  };
  const signed = await signAwsRequest({
    service: "rekognition",
    region: AWS_REGION,
    method: "POST",
    url,
    headers: baseHeaders,
    body,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });
  const res = await fetch(url, { method: "POST", headers: signed, body });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Rekognition ${operation} ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

/**
 * Mints a fresh AWS Face Liveness session. The client SDK
 * (@aws-amplify/ui-react-native FaceLivenessDetector) consumes the
 * SessionId and drives the camera flow; AWS scores the result and
 * stores it under the same SessionId for retrieval.
 */
async function createLivenessSession(): Promise<{ sessionId: string; region: string }> {
  const resp = await callRekognition("CreateFaceLivenessSession", {
    Settings: { AuditImagesLimit: 2 },
  });
  return { sessionId: String(resp.SessionId), region: AWS_REGION };
}

/**
 * Reads the result of a completed Face Liveness session. Returns
 * Confidence (0..100) and Status (CREATED | IN_PROGRESS | SUCCEEDED |
 * FAILED | EXPIRED). The caller compares Confidence against
 * LIVENESS_PASS_THRESHOLD before flipping the VerificationRequest row
 * to 'approved'.
 */
async function getLivenessResult(sessionId: string): Promise<{ confidence: number; status: string }> {
  const resp = await callRekognition("GetFaceLivenessSessionResults", { SessionId: sessionId });
  return {
    confidence: Number(resp.Confidence ?? 0),
    status: String(resp.Status || "UNKNOWN"),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!awsConfigured()) {
    return errorResponse(
      "Liveness not configured. Set AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.",
      503,
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const user = await authenticatedUser(req, supabase);
    if (!user) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      const session = await createLivenessSession();
      // Stash the open session under VerificationRequest so we can
      // reconcile when the result comes back. The 00029 table has the
      // `liveness*` columns we need; if they're absent on older DBs
      // the upsert will fail loud and the operator knows to apply the
      // pending migration.
      const { error: insertErr } = await supabase
        .from("VerificationRequest")
        .insert({
          id: crypto.randomUUID(),
          userId: user.userId,
          status: "pending",
          method: "aws-face-liveness",
          metadata: { sessionId: session.sessionId, region: session.region },
        });
      // 23505 (already a pending row for this user) is non-fatal —
      // we still return the new session id; the older row becomes
      // an audit artifact.
      if (insertErr && insertErr.code !== "23505") {
        throw insertErr;
      }
      return jsonResponse(session);
    }

    if (action === "result") {
      const { sessionId } = body || {};
      if (!sessionId) return errorResponse("sessionId required");

      const result = await getLivenessResult(sessionId);
      const passed = result.status === "SUCCEEDED" && result.confidence >= PASS_THRESHOLD;

      // Mirror the verdict onto VerificationRequest. The 00029 trigger
      // already flips User.isVerified when status transitions to
      // 'approved', so we lean on that rather than touching User
      // directly. Use the most recent matching session.
      await supabase
        .from("VerificationRequest")
        .update({
          status: passed ? "approved" : "rejected",
          reviewedAt: new Date().toISOString(),
          metadata: { sessionId, confidence: result.confidence, awsStatus: result.status },
        })
        .eq("userId", user.userId)
        .eq("status", "pending");

      return jsonResponse({ ...result, passed });
    }

    return errorResponse(`Unknown action: ${action}`);
  } catch (err) {
    console.error("[face-liveness] error:", err);
    await captureException(err, { fn: "face-liveness" });
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
