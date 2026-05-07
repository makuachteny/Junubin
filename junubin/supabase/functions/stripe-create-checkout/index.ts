/**
 * stripe-create-checkout — Supabase Edge Function
 *
 * Creates a Stripe Checkout Session for a single product (subscription OR
 * consumable). Returns the hosted Checkout URL which the client opens in a
 * WebView or redirects to.
 *
 * Request body:
 *   productId: string   — internal Junubin product id, e.g. "com.junubin.sub.plus.monthly"
 *   successUrl: string  — URL Stripe redirects to on success
 *   cancelUrl: string   — URL Stripe redirects to on abort
 *
 * Response:
 *   { sessionId: string, url: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";
import { STRIPE_PRODUCTS } from "../_shared/stripe-products.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_API = "https://api.stripe.com/v1";

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

async function ensureCustomer(
  supabase: any,
  authUserId: string,
  email: string | null,
  name: string | null,
): Promise<{ customerId: string; userId: string }> {
  const { data: appUser } = await supabase
    .from("User")
    .select("id, stripeCustomerId, email, displayName")
    .eq("auth_id", authUserId)
    .maybeSingle();

  if (!appUser) {
    throw new Error("User profile not found");
  }
  if (appUser.stripeCustomerId) {
    return { customerId: appUser.stripeCustomerId, userId: appUser.id };
  }

  // Create a new Stripe customer and persist the id back so subsequent
  // checkouts re-use it (avoids billing-portal duplication).
  const customer = await stripe("POST", "/customers", {
    email: email || appUser.email || undefined,
    name: name || appUser.displayName || undefined,
    metadata: { junubin_user_id: appUser.id, auth_user_id: authUserId },
  });

  await supabase
    .from("User")
    .update({ stripeCustomerId: customer.id })
    .eq("id", appUser.id);

  return { customerId: customer.id, userId: appUser.id };
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

    // Banned users can't buy more product. Letting an active subscription
    // renewal slip through is the operator's call (and handled by the
    // RC/Stripe cancellation hook), but creating a NEW checkout from a
    // banned account is always wrong.
    const { data: caller } = await supabase
      .from("User")
      .select("moderationStatus")
      .eq("auth_id", authUser.id)
      .maybeSingle();
    if (caller?.moderationStatus === "banned") {
      return errorResponse("Account is closed", 403);
    }

    const body = await req.json();
    const { productId, successUrl, cancelUrl } = body;
    if (!productId || !successUrl || !cancelUrl) {
      return errorResponse("Missing required fields: productId, successUrl, cancelUrl");
    }

    const product = STRIPE_PRODUCTS[productId];
    if (!product) {
      return errorResponse(`Unknown productId: ${productId}`, 400);
    }

    const { customerId, userId } = await ensureCustomer(
      supabase,
      authUser.id,
      authUser.email || null,
      authUser.user_metadata?.name || null,
    );

    const sessionBody: Record<string, unknown> = {
      mode: product.kind === "subscription" ? "subscription" : "payment",
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      "line_items[0]": { price: product.stripePriceId, quantity: 1 },
      "automatic_tax[enabled]": "true",
      "payment_method_types[0]": "card",
      // For consumables, attach our internal ids so the webhook can grant
      // entitlements without a DB round-trip.
      "metadata[junubin_user_id]": userId,
      "metadata[junubin_product_id]": productId,
      "metadata[auth_user_id]": authUser.id,
      allow_promotion_codes: "true",
    };

    if (product.kind === "subscription") {
      // Mirror the metadata onto the subscription so renewal webhooks see it.
      sessionBody["subscription_data[metadata][junubin_user_id]"] = userId;
      sessionBody["subscription_data[metadata][junubin_product_id]"] = productId;
      sessionBody["subscription_data[metadata][auth_user_id]"] = authUser.id;
    }

    const session = await stripe("POST", "/checkout/sessions", sessionBody);

    return jsonResponse({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error("stripe-create-checkout error:", err);
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
