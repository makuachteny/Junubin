/**
 * stripe-billing-portal — Supabase Edge Function
 *
 * Creates a Stripe Billing Portal session for the authenticated user
 * so they can self-serve subscription management (update card,
 * cancel, switch plan, download invoices). Returns the portal URL
 * which the client opens in a WebView or via Linking.
 *
 * Request body:
 *   returnUrl: string — URL Stripe redirects back to when the user
 *                       closes the portal (a junubin:// deep link or
 *                       https://junubin.app/account on web).
 *
 * Response:
 *   { url: string }
 *
 * Only callable for users who have a `stripeCustomerId` on the
 * `User` row — i.e. they checked out at least once through Stripe.
 * IAP-subscribed users (App Store / Play Store) manage cancellations
 * through their respective store and never hit this endpoint.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_API = "https://api.stripe.com/v1";

function form(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
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

    const { data: appUser } = await supabase
      .from("User")
      .select("id, stripeCustomerId")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (!appUser?.stripeCustomerId) {
      // No Stripe customer means the user never checked out through
      // Stripe — they're either an IAP subscriber (manage via store)
      // or a free user. Surface a clear 404 so the client can route
      // to the App Store / Play Store URL instead.
      return errorResponse("No Stripe customer for this user", 404);
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl = body?.returnUrl || "junubin://account";

    const session = await stripe("POST", "/billing_portal/sessions", {
      customer: appUser.stripeCustomerId,
      return_url: returnUrl,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("stripe-billing-portal error:", err);
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
