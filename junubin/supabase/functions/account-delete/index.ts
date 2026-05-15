/**
 * account-delete — hard-delete the calling user.
 *
 * App Store guideline 5.1.1.v requires "real" deletion for any app
 * that supports account creation. Soft-deleting (setting deletedAt and
 * leaving the row) was previously the only path; this Edge Function
 * tears down the auth row, the User row (with FK CASCADE handling the
 * downstream tables), and the user's storage objects.
 *
 * Steps:
 *   1. Resolve the caller's auth.users id from the JWT
 *   2. Resolve the matching public.User.id
 *   3. List + delete every storage object the user owns:
 *        - photos/<userId>/...
 *        - posts/<userId>/...
 *   4. Call hard_delete_me() RPC — drops the auth.users row, which
 *      cascades to the User row and downstream (Photo, Profile, Match,
 *      Conversation, Message, Swipe, Follow, Block, Report, Whisper,
 *      GameSession, Post, Story, etc).
 *   5. Return ok — client signs out locally.
 *
 * Why a separate function instead of just RLS-on-delete? Storage
 * objects need a service-role client to enumerate, and RLS on
 * `auth.users` is locked down. SECURITY DEFINER on the RPC bridges
 * that gap.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Buckets that may contain user-owned objects keyed by `<userId>/...`.
// `stories` is intentionally absent: stories are still ephemeral / not
// persisted to Storage in this build. Add it back when the stories
// table + bucket land. The cleanup loop tolerates a missing bucket
// gracefully (caught + logged), so the worst case for an extra entry
// is a noisy warning per delete.
const PHOTO_BUCKETS = ["photos", "posts"];

async function emptyUserFolders(supabase: any, userId: string) {
  for (const bucket of PHOTO_BUCKETS) {
    try {
      const { data: list } = await supabase.storage
        .from(bucket)
        .list(userId, { limit: 1000 });
      if (!list || list.length === 0) continue;
      const paths = list.map((f: any) => `${userId}/${f.name}`);
      await supabase.storage.from(bucket).remove(paths);
    } catch (e) {
      // We don't fail the whole delete on storage cleanup — the row
      // delete is what's required for the App Store guideline. Log so
      // a janitor cron can sweep stragglers.
      console.warn(`account-delete: storage cleanup failed for ${bucket}`, e);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthenticated", 401);

    // Service-role client for storage + auth admin + RPC.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify the JWT and pull out the caller's auth user id. We do not
    // accept a userId in the request body — the only thing this
    // function will ever delete is the row that matches the bearer.
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authUser) return errorResponse("Unauthenticated", 401);

    const { data: appUser } = await admin
      .from("User")
      .select("id")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    // 1. Storage cleanup (best-effort, non-blocking on failure)
    if (appUser?.id) await emptyUserFolders(admin, appUser.id);

    // 2. Cascade delete via RPC (runs as the caller via auth.uid).
    //    Use a caller-scoped client for the RPC so SECURITY DEFINER's
    //    auth.uid() resolves to the user, not to the service role.
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { error: rpcErr } = await userClient.rpc("hard_delete_me");
    if (rpcErr) return errorResponse(rpcErr.message, 500);

    // 3. Belt-and-brace: ensure the auth.users row is gone. The RPC
    //    deletes it, but if it ran in a context where DELETE on
    //    auth.users is forbidden we want to fall back to the admin API.
    try {
      await admin.auth.admin.deleteUser(authUser.id);
    } catch {
      // Already deleted by the RPC — non-fatal.
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("account-delete error:", err);
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
