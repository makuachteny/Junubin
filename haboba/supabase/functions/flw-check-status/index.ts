/**
 * flw-check-status — Supabase Edge Function
 *
 * Polls the payment status for a given transaction reference.
 * Used as a fallback when webhooks are delayed (common with mobile money).
 *
 * If the payment is still pending, optionally calls the Flutterwave
 * verify API to check if it has been completed.
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

    // Look up the payment
    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .select("status, product_id, flw_transaction_id, user_auth_id")
      .eq("flw_tx_ref", txRef)
      .single();

    if (paymentErr || !payment) {
      return errorResponse("Payment not found", 404);
    }

    // Ensure the requesting user owns this payment
    if (payment.user_auth_id !== authUser.id) {
      return errorResponse("Unauthorized", 403);
    }

    // If already resolved, return immediately
    if (payment.status !== "pending") {
      return jsonResponse({
        status: payment.status,
        productId: payment.product_id,
      });
    }

    // If still pending and we have a Flutterwave transaction ID, try to verify
    if (payment.flw_transaction_id && FLW_SECRET) {
      try {
        const verifyRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/${payment.flw_transaction_id}/verify`,
          { headers: { Authorization: `Bearer ${FLW_SECRET}` } }
        );
        const verifyData = await verifyRes.json();

        if (verifyData.data?.status === "successful") {
          // Update payment status — the webhook handler will grant entitlements
          // if it hasn't already
          await supabase
            .from("payments")
            .update({ status: "successful", verified_at: new Date().toISOString() })
            .eq("flw_tx_ref", txRef);

          return jsonResponse({
            status: "successful",
            productId: payment.product_id,
          });
        }

        if (verifyData.data?.status === "failed") {
          await supabase
            .from("payments")
            .update({ status: "failed" })
            .eq("flw_tx_ref", txRef);

          return jsonResponse({
            status: "failed",
            productId: payment.product_id,
          });
        }
      } catch {
        // Verification call failed — return current status
      }
    }

    return jsonResponse({
      status: "pending",
      productId: payment.product_id,
    });
  } catch (err) {
    console.error("flw-check-status error:", err);
    return errorResponse("Internal server error", 500);
  }
});
