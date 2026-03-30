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
  "com.haboba.sub.plus.monthly": "plus",
  "com.haboba.sub.plus.6month": "plus",
  "com.haboba.sub.junub.monthly": "junub",
  "com.haboba.sub.junub.6month": "junub",
};

/** Consumable product quantities */
const CONSUMABLE_MAP: Record<string, { category: string; quantity: number }> = {
  "com.haboba.spotlight.1": { category: "spotlight", quantity: 1 },
  "com.haboba.spotlight.5": { category: "spotlight", quantity: 5 },
  "com.haboba.spotlight.10": { category: "spotlight", quantity: 10 },
  "com.haboba.superlike.5": { category: "superlike", quantity: 5 },
  "com.haboba.superlike.15": { category: "superlike", quantity: 15 },
  "com.haboba.superlike.30": { category: "superlike", quantity: 30 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify webhook signature
    const verifHash = req.headers.get("verif-hash");
    if (FLW_WEBHOOK_SECRET && verifHash !== FLW_WEBHOOK_SECRET) {
      return errorResponse("Invalid webhook signature", 401);
    }

    const body = await req.json();
    const txRef = body?.data?.tx_ref;
    const flwTransactionId = body?.data?.id;

    if (!txRef || !flwTransactionId) {
      return errorResponse("Missing tx_ref or transaction id");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up the pending payment
    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .select("*")
      .eq("flw_tx_ref", txRef)
      .single();

    if (paymentErr || !payment) {
      console.error("Payment not found for tx_ref:", txRef);
      return errorResponse("Payment record not found", 404);
    }

    // Already processed
    if (payment.status === "successful") {
      return jsonResponse({ message: "Already processed" });
    }

    // Verify with Flutterwave API
    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${flwTransactionId}/verify`,
      {
        headers: { Authorization: `Bearer ${FLW_SECRET}` },
      }
    );
    const verifyData = await verifyRes.json();

    if (
      verifyData.status !== "success" ||
      verifyData.data?.status !== "successful"
    ) {
      // Payment failed
      await supabase
        .from("payments")
        .update({ status: "failed", flw_transaction_id: flwTransactionId })
        .eq("flw_tx_ref", txRef);

      return jsonResponse({ message: "Payment verification failed" });
    }

    // Verify amount matches expected price
    const expectedAmount = getServerPrice(
      payment.product_id,
      payment.currency,
      payment.metadata
    );
    const paidAmount = verifyData.data.amount;
    const paidCurrency = verifyData.data.currency;

    if (
      expectedAmount !== null &&
      (Math.abs(paidAmount - expectedAmount) > 1 || paidCurrency !== payment.currency)
    ) {
      console.error(
        `Amount mismatch: expected ${expectedAmount} ${payment.currency}, got ${paidAmount} ${paidCurrency}`
      );
      await supabase
        .from("payments")
        .update({ status: "failed", flw_transaction_id: flwTransactionId })
        .eq("flw_tx_ref", txRef);

      return errorResponse("Amount verification failed");
    }

    // Payment verified — update record
    const now = new Date().toISOString();
    await supabase
      .from("payments")
      .update({
        status: "successful",
        flw_transaction_id: flwTransactionId,
        verified_at: now,
        granted_at: now,
      })
      .eq("flw_tx_ref", txRef);

    // Grant entitlement based on product type
    const productId = payment.product_id;
    const userAuthId = payment.user_auth_id;

    // 1. Subscription
    if (SUBSCRIPTION_TIERS[productId]) {
      const tier = SUBSCRIPTION_TIERS[productId];
      await supabase
        .from("User")
        .update({ subscriptionTier: tier })
        .eq("auth_id", userAuthId);
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
        `Event ticket purchased: user=${userAuthId}, event=${payment.metadata.eventId}`
      );
    }

    return jsonResponse({ message: "Payment verified and entitlement granted" });
  } catch (err) {
    console.error("flw-webhook error:", err);
    return errorResponse("Internal server error", 500);
  }
});
