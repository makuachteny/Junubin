/**
 * flw-webhook — Supabase Edge Function
 *
 * Receives Flutterwave payment webhook notifications.
 * Verifies the payment with Flutterwave's API, then grants
 * the appropriate entitlement (subscription tier, consumables, or event ticket).
 *
 * Flutterwave sends a POST with:
 *   Headers: verif-hash (webhook secret)
 *   Body: { event, data: { tx_ref, id, status, amount, currency, ... } }
 *
 * Defense in depth:
 *   1. verif-hash header must equal FLUTTERWAVE_WEBHOOK_SECRET (or we
 *      fail closed if the secret isn't configured).
 *   2. We re-verify the transaction with Flutterwave's API using
 *      FLUTTERWAVE_SECRET_KEY before granting anything.
 *   3. We re-check the paid amount against our own server-authoritative
 *      price map to defeat tampered amounts.
 *
 * Storage uses the canonical `Payment` table (00009_stripe.sql) keyed
 * by (provider, providerRef) so Stripe + Flutterwave + Apple + Google
 * all share one schema and the unique index gives us free idempotency
 * across retries.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { getServerPrice } from "../_shared/flw-products.ts";

const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") || "";
const FLW_WEBHOOK_SECRET = Deno.env.get("FLUTTERWAVE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/** Product ID to subscription tier mapping */
const SUBSCRIPTION_TIERS: Record<string, string> = {
  "com.junubin.sub.plus.monthly": "plus",
  "com.junubin.sub.plus.6month": "plus",
  "com.junubin.sub.junub.monthly": "junub",
  "com.junubin.sub.junub.6month": "junub",
};

/** Consumable product quantities */
const CONSUMABLE_MAP: Record<string, { category: string; quantity: number }> = {
  "com.junubin.spotlight.1": { category: "spotlight", quantity: 1 },
  "com.junubin.spotlight.5": { category: "spotlight", quantity: 5 },
  "com.junubin.spotlight.10": { category: "spotlight", quantity: 10 },
  "com.junubin.superlike.5": { category: "superlike", quantity: 5 },
  "com.junubin.superlike.15": { category: "superlike", quantity: 15 },
  "com.junubin.superlike.30": { category: "superlike", quantity: 30 },
};

/**
 * Constant-time string comparison. The naive `a === b` short-circuits
 * on the first non-matching byte, which leaks length-of-prefix info
 * via timing. For a fixed-length shared secret this is mostly
 * theoretical, but it's cheap and standard practice.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Fail closed if the webhook secret isn't set in the project. The
  // previous version silently allowed any caller through when the
  // secret was empty, which would let an attacker pump forged
  // notifications at the verify-with-Flutterwave step.
  if (!FLW_WEBHOOK_SECRET) {
    console.error("FLUTTERWAVE_WEBHOOK_SECRET is not configured");
    return errorResponse("Webhook secret not configured", 500);
  }
  if (!FLW_SECRET) {
    console.error("FLUTTERWAVE_SECRET_KEY is not configured");
    return errorResponse("Server not configured", 500);
  }

  try {
    const verifHash = req.headers.get("verif-hash") || "";
    if (!timingSafeEqual(verifHash, FLW_WEBHOOK_SECRET)) {
      return errorResponse("Invalid webhook signature", 401);
    }

    const body = await req.json();
    const eventType = body?.event || body?.["event.type"] || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Payout settlement events (00023) ──────────────────────────
    // Flutterwave settles transfers asynchronously; the
    // process-payout function leaves the request at 'processing' and
    // we transition it to 'paid' / 'rejected' here. We key on the
    // Flutterwave transaction id we stashed in metadata.transactionId.
    if (eventType === "transfer.completed" || eventType === "transfer.failed") {
      const transferId = body?.data?.id;
      const flwStatus = body?.data?.status; // 'SUCCESSFUL' | 'FAILED' | ...
      if (!transferId) return errorResponse("Missing transfer id");

      const { data: payoutRow, error: lookupErr } = await supabase
        .from("PayoutRequest")
        .select("id, status, metadata")
        .eq("metadata->>transactionId", String(transferId))
        .maybeSingle();

      if (lookupErr) {
        console.error("PayoutRequest lookup failed:", lookupErr);
        return errorResponse("Lookup failed", 500);
      }
      if (!payoutRow) {
        console.warn("No PayoutRequest for FLW transferId", transferId);
        return jsonResponse({ message: "Unknown transfer, ignored" });
      }

      // Already finalised — webhook retries are no-ops.
      if (payoutRow.status === "paid" || payoutRow.status === "rejected") {
        return jsonResponse({ message: "Already processed" });
      }

      const isSuccess =
        eventType === "transfer.completed" &&
        (flwStatus === "SUCCESSFUL" || flwStatus === "successful");

      const merged = {
        ...(payoutRow.metadata || {}),
        flwTransferStatus: flwStatus,
        flwTransferEvent: eventType,
        settledAt: new Date().toISOString(),
      };

      const { error: updErr } = await supabase
        .from("PayoutRequest")
        .update({
          status: isSuccess ? "paid" : "rejected",
          rejectionReason: isSuccess ? null : (body?.data?.complete_message || `Transfer ${flwStatus || "failed"}`),
          resolvedAt: new Date().toISOString(),
          metadata: merged,
        })
        .eq("id", payoutRow.id);

      if (updErr) {
        console.error("Failed to settle PayoutRequest:", updErr);
        return errorResponse("Failed to settle", 500);
      }
      return jsonResponse({ message: "Payout settled", status: isSuccess ? "paid" : "rejected" });
    }

    // ── Inbound payment events (legacy path) ──────────────────────
    const txRef = body?.data?.tx_ref;
    const flwTransactionId = body?.data?.id;

    if (!txRef || !flwTransactionId) {
      return errorResponse("Missing tx_ref or transaction id");
    }

    // Look up the pending Payment row keyed on (provider, providerRef).
    // The unique index from 00009 means there's at most one match.
    const { data: payment, error: paymentErr } = await supabase
      .from("Payment")
      .select("id, userId, junubinProductId, currency, status, metadata")
      .eq("provider", "flutterwave")
      .eq("providerRef", txRef)
      .maybeSingle();

    if (paymentErr) {
      console.error("Payment lookup failed:", paymentErr);
      return errorResponse("Payment lookup failed", 500);
    }
    if (!payment) {
      console.error("Payment not found for tx_ref:", txRef);
      return errorResponse("Payment record not found", 404);
    }

    // Already processed — make webhook retries no-ops.
    if (payment.status === "succeeded") {
      return jsonResponse({ message: "Already processed" });
    }

    // Resolve the auth_id we'll need for entitlement RPCs (the User
    // row is keyed by Payment.userId; the consumable / tier helpers
    // expect auth_id).
    const { data: appUser } = await supabase
      .from("User")
      .select("auth_id")
      .eq("id", payment.userId)
      .maybeSingle();
    const userAuthId = appUser?.auth_id;
    if (!userAuthId) {
      console.error("User auth_id not found for Payment.userId:", payment.userId);
      return errorResponse("User not found", 404);
    }

    // Re-verify with Flutterwave directly. Even if the verif-hash
    // check passes, this is the second line of defense — only
    // Flutterwave can produce a 'successful' verification response.
    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${flwTransactionId}/verify`,
      {
        headers: { Authorization: `Bearer ${FLW_SECRET}` },
      },
    );
    const verifyData = await verifyRes.json();

    if (
      verifyData.status !== "success" ||
      verifyData.data?.status !== "successful"
    ) {
      const { error: failErr } = await supabase
        .from("Payment")
        .update({
          status: "failed",
          metadata: { ...(payment.metadata || {}), flwTransactionId },
          updatedAt: new Date().toISOString(),
        })
        .eq("id", payment.id);
      if (failErr) console.error("Failed to mark Payment failed:", failErr);

      return jsonResponse({ message: "Payment verification failed" });
    }

    // Verify amount matches expected price. getServerPrice returns the
    // major-unit value; Payment.amountCents is minor units, but here
    // we compare against the Flutterwave-reported amount which is
    // also in major units, so the comparison is direct.
    const expectedAmount = getServerPrice(
      payment.junubinProductId,
      payment.currency,
      payment.metadata,
    );
    const paidAmount = verifyData.data.amount;
    const paidCurrency = verifyData.data.currency;

    if (
      expectedAmount !== null &&
      (Math.abs(paidAmount - expectedAmount) > 1 || paidCurrency !== payment.currency)
    ) {
      console.error(
        `Amount mismatch: expected ${expectedAmount} ${payment.currency}, got ${paidAmount} ${paidCurrency}`,
      );
      const { error: failErr } = await supabase
        .from("Payment")
        .update({
          status: "failed",
          metadata: { ...(payment.metadata || {}), flwTransactionId, mismatch: { expectedAmount, paidAmount, paidCurrency } },
          updatedAt: new Date().toISOString(),
        })
        .eq("id", payment.id);
      if (failErr) console.error("Failed to mark Payment mismatch:", failErr);

      return errorResponse("Amount verification failed");
    }

    // Payment verified — record success.
    const { error: successErr } = await supabase
      .from("Payment")
      .update({
        status: "succeeded",
        metadata: { ...(payment.metadata || {}), flwTransactionId, verifiedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (successErr) {
      console.error("Failed to mark Payment succeeded:", successErr);
      return errorResponse("Failed to record success", 500);
    }

    // Grant entitlement based on product type
    const productId = payment.junubinProductId;

    // 1. Subscription
    if (SUBSCRIPTION_TIERS[productId]) {
      const tier = SUBSCRIPTION_TIERS[productId];
      const { error: tierErr } = await supabase
        .from("User")
        .update({ subscriptionTier: tier })
        .eq("auth_id", userAuthId);
      if (tierErr) console.error("Failed to set subscription tier:", tierErr);
    }

    // 2. Consumable
    if (CONSUMABLE_MAP[productId]) {
      const { category, quantity } = CONSUMABLE_MAP[productId];
      if (category === "spotlight") {
        await supabase.rpc("add_spotlights", { user_auth_id: userAuthId, amount: quantity });
      } else if (category === "superlike") {
        await supabase.rpc("add_superlikes", { user_auth_id: userAuthId, amount: quantity });
      }
    }

    // 3. Event ticket — record attendance
    if (productId.startsWith("event_ticket_") && payment.metadata?.eventId) {
      // Could insert into an event_attendees table here
      console.log(
        `Event ticket purchased: user=${userAuthId}, event=${payment.metadata.eventId}`,
      );
    }

    return jsonResponse({ message: "Payment verified and entitlement granted" });
  } catch (err) {
    console.error("flw-webhook error:", err);
    return errorResponse("Internal server error", 500);
  }
});
