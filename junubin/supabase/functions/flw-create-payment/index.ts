/**
 * flw-create-payment — Supabase Edge Function
 *
 * Creates a Flutterwave payment link for subscriptions, consumables, or event tickets.
 * The client receives the payment link URL to open in a WebView.
 *
 * Request body:
 *   productId: string       — Product ID or "event_ticket_{eventId}"
 *   paymentMethod: string   — 'mpesa' | 'momo' | 'airtel' | 'bank_transfer' | 'card'
 *   currency: string        — ISO currency code (e.g. 'KES')
 *   txRef: string           — Client-generated unique transaction reference
 *   phoneNumber?: string    — Required for mobile money methods
 *   eventMeta?: object      — { eventId, eventTitle, ticketTier } for event tickets
 *
 * Response:
 *   { paymentLink: string, txRef: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";
import { getServerPrice } from "../_shared/flw-products.ts";

const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const REDIRECT_URL = Deno.env.get("FLUTTERWAVE_REDIRECT_URL") || "https://junubin.app/payment/callback";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) return errorResponse("Unauthorized", 401);

    // Parse request
    const body = await req.json();
    const { productId, paymentMethod, currency, txRef, phoneNumber, eventMeta } = body;

    if (!productId || !paymentMethod || !currency || !txRef) {
      return errorResponse("Missing required fields: productId, paymentMethod, currency, txRef");
    }

    // Look up server-authoritative price
    const amount = getServerPrice(productId, currency, eventMeta);
    if (amount === null) {
      return errorResponse(`No pricing found for ${productId} in ${currency}`);
    }

    // Get user profile for customer info + moderation gate. Banned
    // accounts shouldn't be able to start a new payment flow even
    // through the Flutterwave path; mirror the Stripe-side guard.
    // We also need User.id (the app-level user id) to write the Payment
    // row — Payment.userId references User.id, not auth.id.
    const { data: userProfile } = await supabase
      .from("User")
      .select("id, displayName, email, phone, moderationStatus")
      .eq("auth_id", authUser.id)
      .single();
    if (!userProfile) {
      return errorResponse("User record not found", 404);
    }
    if (userProfile.moderationStatus === "banned") {
      return errorResponse("Account is closed", 403);
    }

    // Build Flutterwave payment payload
    const flwPayload: Record<string, unknown> = {
      tx_ref: txRef,
      amount,
      currency,
      redirect_url: REDIRECT_URL,
      customer: {
        email: authUser.email || userProfile?.email || `${authUser.id}@junubin.app`,
        phonenumber: phoneNumber || userProfile?.phone || "",
        name: userProfile?.displayName || "Junubin User",
      },
      customizations: {
        title: "Junubin",
        description: eventMeta?.eventTitle
          ? `Ticket: ${eventMeta.eventTitle}`
          : `Purchase: ${productId}`,
        logo: "https://junubin.app/logo.png",
      },
      meta: {
        user_auth_id: authUser.id,
        product_id: productId,
        payment_method: paymentMethod,
        ...(eventMeta || {}),
      },
    };

    // Set payment method options for Flutterwave
    if (paymentMethod === "mpesa") {
      flwPayload.payment_options = "mpesa";
    } else if (paymentMethod === "momo") {
      flwPayload.payment_options = "mobilemoney";
    } else if (paymentMethod === "bank_transfer") {
      flwPayload.payment_options = "banktransfer";
    } else if (paymentMethod === "card") {
      flwPayload.payment_options = "card";
    }

    // Call Flutterwave Standard Payments API
    const flwResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flwPayload),
    });

    const flwData = await flwResponse.json();

    if (flwData.status !== "success" || !flwData.data?.link) {
      console.error("Flutterwave create payment failed:", flwData);
      return errorResponse(flwData.message || "Failed to create payment", 502);
    }

    // Insert pending payment record into the canonical `Payment` table
    // (the same table Stripe writes to — provider/providerRef
    // discriminate). Amount is stored in minor units (cents) to match
    // the Stripe code path; Flutterwave reports amounts in major units
    // so we multiply by 100 here.
    //
    // The (provider, providerRef) unique index makes this insert
    // idempotent — a re-issued txRef will surface as a 23505 the
    // caller can treat as "already created" without leaking duplicates.
    const { error: insertError } = await supabase.from("Payment").insert({
      id: crypto.randomUUID(),
      userId: userProfile.id,
      provider: "flutterwave",
      providerRef: txRef,
      providerCustomerId: null,
      junubinProductId: productId,
      amountCents: Math.round(amount * 100),
      currency,
      status: "pending",
      subscriptionId: null,
      metadata: { ...(eventMeta || {}), paymentMethod },
    });

    if (insertError && insertError.code !== "23505") {
      console.error("flw-create-payment Payment insert failed:", insertError);
      return errorResponse("Failed to record payment", 500);
    }

    return jsonResponse({
      paymentLink: flwData.data.link,
      txRef,
    });
  } catch (err) {
    console.error("flw-create-payment error:", err);
    return errorResponse("Internal server error", 500);
  }
});
