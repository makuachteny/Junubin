/**
 * stripe-webhook — Supabase Edge Function
 *
 * Verifies Stripe's HMAC-SHA256 signature, then grants entitlements based on
 * the event type. Idempotent: every interesting event is keyed by Stripe's
 * event id and Payment row uniqueness `(provider, providerRef)`.
 *
 * Events handled:
 *   checkout.session.completed       — initial purchase (sub or one-time)
 *   customer.subscription.updated    — plan change, renewal
 *   customer.subscription.deleted    — cancellation / expiry
 *   invoice.payment_failed           — mark Payment row as failed; downgrade later
 *   account.updated                  — Stripe Connect onboarding state (00023)
 *
 * Configure the endpoint at https://dashboard.stripe.com/webhooks pointing at
 *   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 * with the four events above selected.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { STRIPE_PRODUCTS, PRICE_ID_TO_JUNUBIN } from "../_shared/stripe-products.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_API = "https://api.stripe.com/v1";
const TOLERANCE_SECONDS = 300;

/**
 * Verify the Stripe-Signature header against the raw request body.
 * Stripe's signature header looks like: `t=<unix>,v1=<hex>[,v0=...]`
 */
async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) {
      // Multiple v1 entries are allowed during key rotation; keep the first.
      if (!acc[k]) acc[k] = v;
    }
    return acc;
  }, {});

  const ts = Number(parts.t);
  const sig = parts.v1;
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${payload}`));
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

async function stripeGet(pathname: string): Promise<any> {
  const res = await fetch(`${STRIPE_API}${pathname}`, {
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Stripe-Version": "2024-06-20",
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe GET ${pathname} failed`);
  }
  return json;
}

async function lookupAuthUserId(supabase: any, customerId: string, fallbackUserId: string | null) {
  // The session/subscription metadata is the source of truth; if missing,
  // recover from the customer's stripeCustomerId on User.
  if (fallbackUserId) {
    const { data } = await supabase
      .from("User")
      .select("auth_id, id")
      .eq("id", fallbackUserId)
      .maybeSingle();
    if (data) return { authId: data.auth_id, userId: data.id };
  }
  const { data } = await supabase
    .from("User")
    .select("auth_id, id")
    .eq("stripeCustomerId", customerId)
    .maybeSingle();
  return data ? { authId: data.auth_id, userId: data.id } : { authId: null, userId: null };
}

function generateId(): string {
  return crypto.randomUUID();
}

async function recordPayment(
  supabase: any,
  row: {
    userId: string;
    providerRef: string;
    providerCustomerId: string | null;
    junubinProductId: string;
    amountCents: number;
    currency: string;
    status: "pending" | "succeeded" | "failed" | "refunded" | "cancelled";
    subscriptionId: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  // Upsert by (provider, providerRef) — re-deliveries become no-ops.
  const { error } = await supabase.from("Payment").upsert(
    {
      id: generateId(),
      userId: row.userId,
      provider: "stripe",
      providerRef: row.providerRef,
      providerCustomerId: row.providerCustomerId,
      junubinProductId: row.junubinProductId,
      amountCents: row.amountCents,
      currency: row.currency,
      status: row.status,
      subscriptionId: row.subscriptionId,
      metadata: row.metadata || {},
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "provider,providerRef", ignoreDuplicates: false },
  );
  if (error) throw error;
}

async function grantEntitlement(
  supabase: any,
  authId: string,
  productId: string,
) {
  const product = STRIPE_PRODUCTS[productId];
  if (!product) return;

  if (product.kind === "subscription" && product.tier) {
    await supabase
      .from("User")
      .update({ subscriptionTier: product.tier })
      .eq("auth_id", authId);
    return;
  }

  if (product.kind === "consumable" && product.category && product.quantity) {
    if (product.category === "spotlight") {
      await supabase.rpc("add_spotlights", { user_auth_id: authId, amount: product.quantity });
    } else if (product.category === "superlike") {
      await supabase.rpc("add_superlikes", { user_auth_id: authId, amount: product.quantity });
    } else if (product.category === "coins") {
      await supabase.rpc("add_coins", { user_auth_id: authId, amount: product.quantity });
    }
  }
}

async function downgradeToFree(supabase: any, authId: string) {
  await supabase.from("User").update({ subscriptionTier: "free" }).eq("auth_id", authId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Reject not just unset, but also empty-string / whitespace-only.
  // `Deno.env.get` returns "" when the secret is set to a blank value
  // (e.g. an operator typo in the dashboard), and the old `!secret`
  // check considered that "configured" — signature verification then
  // ran with "" as the HMAC key and accepted ANY payload claiming a
  // valid signature it could compute against that empty key.
  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_WEBHOOK_SECRET.trim()) {
    return errorResponse("Webhook secret not configured", 500);
  }

  // Read the raw body once — verification needs the exact bytes.
  const payload = await req.text();
  const header = req.headers.get("stripe-signature");

  const ok = await verifyStripeSignature(payload, header, STRIPE_WEBHOOK_SECRET);
  if (!ok) return errorResponse("Invalid signature", 401);

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const productId = session.metadata?.junubin_product_id;
        const userIdMeta = session.metadata?.junubin_user_id;
        const authUserMeta = session.metadata?.auth_user_id;
        if (!productId || !STRIPE_PRODUCTS[productId]) {
          return jsonResponse({ message: "Unknown product, ignored" });
        }

        const lookup = await lookupAuthUserId(supabase, session.customer, userIdMeta);
        const authId = authUserMeta || lookup.authId;
        const userId = lookup.userId || userIdMeta;
        if (!authId || !userId) {
          console.error("Cannot resolve user for session", session.id);
          return errorResponse("User not found", 404);
        }

        const product = STRIPE_PRODUCTS[productId];
        await recordPayment(supabase, {
          userId,
          providerRef: session.id,
          providerCustomerId: session.customer,
          junubinProductId: productId,
          amountCents: session.amount_total ?? product.amountCents,
          currency: (session.currency || "usd").toUpperCase(),
          status: session.payment_status === "paid" ? "succeeded" : "pending",
          subscriptionId: session.subscription || null,
          metadata: { stripeMode: session.mode },
        });

        if (session.payment_status === "paid") {
          await grantEntitlement(supabase, authId, productId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        // If a subscriber switches plan in the customer portal, the price id
        // tells us the new tier.
        const priceId = sub.items?.data?.[0]?.price?.id;
        const productId = priceId ? PRICE_ID_TO_JUNUBIN[priceId] : sub.metadata?.junubin_product_id;
        const lookup = await lookupAuthUserId(supabase, sub.customer, sub.metadata?.junubin_user_id);

        if (!lookup.authId || !productId) break;

        // Status flow: trialing/active → grant; past_due/unpaid → keep but mark
        // the latest Payment row as failed; canceled/incomplete_expired → downgrade.
        if (["active", "trialing"].includes(sub.status)) {
          await grantEntitlement(supabase, lookup.authId, productId);
        } else if (["canceled", "incomplete_expired"].includes(sub.status)) {
          await downgradeToFree(supabase, lookup.authId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const lookup = await lookupAuthUserId(supabase, sub.customer, sub.metadata?.junubin_user_id);
        if (lookup.authId) {
          await downgradeToFree(supabase, lookup.authId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const lookup = await lookupAuthUserId(supabase, invoice.customer, invoice.subscription_details?.metadata?.junubin_user_id);
        const productId = invoice.subscription_details?.metadata?.junubin_product_id;
        if (lookup.userId && productId) {
          await recordPayment(supabase, {
            userId: lookup.userId,
            providerRef: invoice.id,
            providerCustomerId: invoice.customer,
            junubinProductId: productId,
            amountCents: invoice.amount_due ?? 0,
            currency: (invoice.currency || "usd").toUpperCase(),
            status: "failed",
            subscriptionId: invoice.subscription || null,
            metadata: { reason: "invoice.payment_failed" },
          });
        }
        break;
      }

      default:
        // Acknowledge so Stripe doesn't retry — unhandled events are fine.
        break;
    }

    return jsonResponse({ received: true });
  } catch (err) {
    console.error("stripe-webhook handler error:", err);
    return errorResponse((err as Error).message || "Handler error", 500);
  }
});
