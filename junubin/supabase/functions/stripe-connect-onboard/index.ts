/**
 * stripe-connect-onboard — Supabase Edge Function
 *
 * Authenticated endpoint. Creates (or reuses) a Stripe Connect Express
 * account for the caller and returns a Stripe-hosted onboarding URL
 * that the client opens in a WebView. Onboarded creators can then
 * receive payouts via Stripe Transfers (see process-payout).
 *
 * Request: empty body — caller is identified by Authorization header.
 * Response: { url: string, accountId: string }
 *
 * KYC, bank-detail collection, and identity verification all happen on
 * Stripe's side. We only persist the account id and the cached
 * chargesEnabled / payoutsEnabled flags (updated via the account.updated
 * webhook) so the UI can decide whether the user is transfer-ready
 * without round-tripping to Stripe on every render.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_API = "https://api.stripe.com/v1";

// Where Stripe sends the user back after onboarding (or when they need
// to refresh an expired link). Configurable via env so staging /
// production point at different hosts; defaults to the production
// universal-link target.
const RETURN_URL = Deno.env.get("STRIPE_CONNECT_RETURN_URL") || "https://junubin.app/payouts/return";
const REFRESH_URL = Deno.env.get("STRIPE_CONNECT_REFRESH_URL") || "https://junubin.app/payouts/return";

/**
 * Encode a nested object as application/x-www-form-urlencoded the way
 * Stripe expects (`a[b][c]=v`). Mirrors the helper in
 * stripe-create-checkout — duplicated here rather than shared because
 * Edge Functions are individually deployed and we want each function
 * to be self-contained for cold-start clarity.
 */
function form(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") {
      parts.push(form(v as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

async function stripe(method: string, pathname: string, body?: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${STRIPE_API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: body ? form(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe ${method} ${pathname} failed`);
  }
  return json;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      return errorResponse("Stripe not configured", 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) return errorResponse("Unauthorized", 401);

    const { data: appUser, error: userErr } = await supabase
      .from("User")
      .select("id, email, displayName, countryCode, stripeConnectAccountId, moderationStatus")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (userErr || !appUser) {
      return errorResponse("User profile not found", 404);
    }

    // Banned users can't onboard for payouts. Mirrors the guard in
    // stripe-create-checkout — banned accounts shouldn't be moving
    // money in either direction.
    if (appUser.moderationStatus === "banned") {
      return errorResponse("Account is closed", 403);
    }

    let accountId = appUser.stripeConnectAccountId;

    if (!accountId) {
      // First-time onboarding. Stripe Express accounts require a
      // country at creation time and can't be migrated between
      // countries later — fall back to US if the user hasn't set
      // one (the Stripe-hosted form will still ask them to confirm).
      const country = (appUser.countryCode && String(appUser.countryCode).length === 2)
        ? String(appUser.countryCode).toUpperCase()
        : "US";

      const account = await stripe("POST", "/accounts", {
        type: "express",
        country,
        email: appUser.email || authUser.email || undefined,
        capabilities: {
          transfers: { requested: "true" },
        },
        // Tag the account so the account.updated webhook can map back
        // to our user without a join through email.
        metadata: {
          junubin_user_id: appUser.id,
          auth_user_id: authUser.id,
        },
      });

      accountId = account.id as string;

      const { error: updErr } = await supabase
        .from("User")
        .update({ stripeConnectAccountId: accountId })
        .eq("id", appUser.id);
      if (updErr) {
        console.error("Failed to persist stripeConnectAccountId:", updErr);
        return errorResponse("Failed to persist Connect account", 500);
      }
    }

    // Always mint a fresh AccountLink — they're single-use and expire
    // after a few minutes, so re-issuing on every "Set up payouts" tap
    // is the documented pattern.
    const link = await stripe("POST", "/account_links", {
      account: accountId,
      return_url: RETURN_URL,
      refresh_url: REFRESH_URL,
      type: "account_onboarding",
    });

    return jsonResponse({ url: link.url, accountId });
  } catch (err) {
    console.error("stripe-connect-onboard error:", err);
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
