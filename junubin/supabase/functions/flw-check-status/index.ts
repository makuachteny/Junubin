/**
 * flw-check-status — Supabase Edge Function
 *
 * Polls the payment status for a given transaction reference.
 * Used as a fallback when webhooks are delayed (common with mobile money).
 *
 * If the payment is still pending, optionally calls the Flutterwave
 * verify API to check if it has been completed. Note: this only flips
 * the Payment row to 'succeeded' — granting consumables/tier still
 * happens in flw-webhook so that path stays the single source of truth
 * for entitlement.
 *
 * Request body: { txRef: string }
 * Response: { status: string, productId: string | null }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";

const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) return errorResponse("Unauthorized", 401);

    const { txRef } = await req.json();
    if (!txRef) return errorResponse("Missing txRef");

    // Resolve the caller's app User.id so we can scope the lookup.
    const { data: appUser } = await supabase
      .from("User")
      .select("id")
      .eq("auth_id", authUser.id)
      .maybeSingle();
    if (!appUser) return errorResponse("User not found", 404);

    // Look up the Payment row in the canonical table (00009).
    const { data: payment, error: paymentErr } = await supabase
      .from("Payment")
      .select("id, userId, junubinProductId, status, metadata")
      .eq("provider", "flutterwave")
      .eq("providerRef", txRef)
      .maybeSingle();

    if (paymentErr) {
      console.error("Payment lookup failed:", paymentErr);
      return errorResponse("Payment lookup failed", 500);
    }
    if (!payment) {
      return errorResponse("Payment not found", 404);
    }

    // Ensure the requesting user owns this payment.
    if (payment.userId !== appUser.id) {
      return errorResponse("Unauthorized", 403);
    }

    // If already resolved, return immediately.
    if (payment.status !== "pending") {
      return jsonResponse({
        status: payment.status,
        productId: payment.junubinProductId,
      });
    }

    // If still pending, ask Flutterwave directly. Their tx-ref-search
    // endpoint accepts the merchant's tx_ref so we don't need to have
    // captured the Flutterwave transaction id yet (which is what was
    // missing from the previous version when no webhook had landed).
    if (FLW_SECRET) {
      try {
        const verifyRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
          { headers: { Authorization: `Bearer ${FLW_SECRET}` } },
        );
        const verifyData = await verifyRes.json();
        const flwStatus = verifyData?.data?.status;

        if (flwStatus === "successful") {
          // Mark succeeded — but DO NOT grant entitlement here. The
          // webhook is the single grant path; this poll just keeps
          // the UI from spinning forever when the webhook is slow.
          // Idempotency on (provider, providerRef) means a double
          // grant from this path + the webhook is impossible, but
          // splitting concerns keeps the audit trail clean.
          const { error: updErr } = await supabase
            .from("Payment")
            .update({
              status: "succeeded",
              metadata: {
                ...(payment.metadata || {}),
                statusCheckedAt: new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            })
            .eq("id", payment.id);
          if (updErr) console.error("Failed to mark Payment succeeded:", updErr);

          return jsonResponse({
            status: "succeeded",
            productId: payment.junubinProductId,
          });
        }

        if (flwStatus === "failed") {
          const { error: updErr } = await supabase
            .from("Payment")
            .update({ status: "failed", updatedAt: new Date().toISOString() })
            .eq("id", payment.id);
          if (updErr) console.error("Failed to mark Payment failed:", updErr);

          return jsonResponse({
            status: "failed",
            productId: payment.junubinProductId,
          });
        }
      } catch {
        // Verification call failed — return current status.
      }
    }

    return jsonResponse({
      status: "pending",
      productId: payment.junubinProductId,
    });
  } catch (err) {
    console.error("flw-check-status error:", err);
    return errorResponse("Internal server error", 500);
  }
});
