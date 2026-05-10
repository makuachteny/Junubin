/**
 * process-payout — Supabase Edge Function (service-role only)
 *
 * Fulfills a PayoutRequest by calling the actual provider transfer
 * API (Stripe Transfers for `stripe_connect`, Flutterwave Transfers
 * for `mobile_money` / `bank_transfer`). Service-role-gated for v1 —
 * an operator triggers each request via Supabase Studio or curl. We'll
 * graduate to auto-processing in v2 after we've watched enough manual
 * runs to trust the failure modes.
 *
 * Request body: { requestId: string }
 * Response:     the updated PayoutRequest row (status flipped to
 *               'paid' for Stripe-completed transfers, 'processing'
 *               for Flutterwave async transfers, or 'rejected' on
 *               provider failure with rejectionReason populated).
 *
 * Currency assumptions (MVP):
 *   100 coins = $1 USD = 100 cents
 *   1000 coins ≈ $10 USD ≈ 1300 KES (hardcoded fallback for Flutterwave;
 *   the user is paid in their local currency, we're not running an FX
 *   desk). This is intentionally simple — once we have payout volume
 *   we'll replace the constant with the Flutterwave rate API.
 *
 * KYC is delegated to the providers entirely. We never see bank
 * numbers (Stripe handles them) or run our own checks beyond what the
 * provider returns.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const FLW_SECRET = Deno.env.get("FLUTTERWAVE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const STRIPE_API = "https://api.stripe.com/v1";
const FLW_API = "https://api.flutterwave.com/v3";

// 100 coins = $1 USD = 100 cents (Stripe's minor-unit currency).
const COINS_PER_USD = 100;
// Flutterwave transfers settle in major units, not cents.
// 1000 coins ≈ $10 USD ≈ 1300 KES (hardcoded MVP rate; replace with
// Flutterwave rate API when payout volume justifies it).
const USD_TO_KES = 130; // 1 USD ≈ 130 KES at MVP fix point

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

async function flwPost(pathname: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${FLW_API}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.status !== "success") {
    throw new Error(json.message || `Flutterwave POST ${pathname} failed`);
  }
  return json;
}

/**
 * Mark the request rejected with a reason. Coins are NOT credited
 * back automatically — operator decision; the audit trail stays
 * clean. Returns the updated row for the response.
 */
async function rejectRequest(supabase: any, requestId: string, reason: string, metadataExtra: Record<string, unknown> = {}) {
  const { data: existing } = await supabase
    .from("PayoutRequest")
    .select("metadata")
    .eq("id", requestId)
    .maybeSingle();

  const merged = { ...(existing?.metadata || {}), ...metadataExtra, lastError: reason };

  const { data, error } = await supabase
    .from("PayoutRequest")
    .update({
      status: "rejected",
      rejectionReason: reason,
      resolvedAt: new Date().toISOString(),
      metadata: merged,
    })
    .eq("id", requestId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("rejectRequest update failed:", error);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_SERVICE_KEY) {
      return errorResponse("Service key not configured", 500);
    }

    // Service-role gate. An operator running this from Supabase Studio
    // or curl passes the service-role key as the bearer token.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token !== SUPABASE_SERVICE_KEY) {
      return errorResponse("Forbidden: service role required", 403);
    }

    const body = await req.json().catch(() => ({}));
    const requestId = body?.requestId;
    if (!requestId || typeof requestId !== "string") {
      return errorResponse("requestId required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Atomically claim the row via the admin_process_payout RPC —
    // flips pending → processing under a row lock. Two concurrent
    // operator triggers won't both fulfill the same request.
    const { error: claimErr } = await supabase.rpc("admin_process_payout", { request_id: requestId });
    if (claimErr) {
      return errorResponse(`Could not claim request: ${claimErr.message}`, 409);
    }

    const { data: request, error: reqErr } = await supabase
      .from("PayoutRequest")
      .select("id, userId, coinAmount, method, destination, status, metadata")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !request) {
      return errorResponse("Payout request not found", 404);
    }

    const { data: userRow, error: userErr } = await supabase
      .from("User")
      .select("id, email, displayName, countryCode, stripeConnectAccountId, stripeConnectPayoutsEnabled")
      .eq("id", request.userId)
      .maybeSingle();

    if (userErr || !userRow) {
      const updated = await rejectRequest(supabase, requestId, "User not found");
      return jsonResponse({ payoutRequest: updated }, 404);
    }

    // ── Stripe Connect transfer ─────────────────────────────────────
    if (request.method === "stripe_connect") {
      if (!STRIPE_SECRET_KEY) {
        const updated = await rejectRequest(supabase, requestId, "Stripe not configured");
        return jsonResponse({ payoutRequest: updated }, 500);
      }
      if (!userRow.stripeConnectAccountId) {
        const updated = await rejectRequest(supabase, requestId, "Stripe Connect account not set up");
        return jsonResponse({ payoutRequest: updated }, 400);
      }
      if (!userRow.stripeConnectPayoutsEnabled) {
        const updated = await rejectRequest(supabase, requestId, "Stripe Connect payouts not yet enabled");
        return jsonResponse({ payoutRequest: updated }, 400);
      }

      // 100 coins = $1 USD = 100 cents.
      const amountCents = Math.floor((request.coinAmount / COINS_PER_USD) * 100);
      if (amountCents <= 0) {
        const updated = await rejectRequest(supabase, requestId, "Computed amount is zero");
        return jsonResponse({ payoutRequest: updated }, 400);
      }

      try {
        const transfer = await stripe("POST", "/transfers", {
          amount: amountCents,
          currency: "usd",
          destination: userRow.stripeConnectAccountId,
          transfer_group: requestId,
          metadata: {
            junubin_payout_request_id: requestId,
            junubin_user_id: userRow.id,
          },
        });

        const merged = {
          ...(request.metadata || {}),
          provider: "stripe",
          transferId: transfer.id,
          amountCents,
          currency: "usd",
        };

        const { data: updated, error: updErr } = await supabase
          .from("PayoutRequest")
          .update({
            status: "paid",
            resolvedAt: new Date().toISOString(),
            metadata: merged,
          })
          .eq("id", requestId)
          .select("*")
          .maybeSingle();

        if (updErr) {
          console.error("Failed to mark payout paid:", updErr);
          return errorResponse("Transfer succeeded but DB update failed", 500);
        }
        return jsonResponse({ payoutRequest: updated });
      } catch (err) {
        const updated = await rejectRequest(supabase, requestId, (err as Error).message || "Stripe transfer failed");
        return jsonResponse({ payoutRequest: updated }, 502);
      }
    }

    // ── Flutterwave mobile money / bank transfer ────────────────────
    if (request.method === "mobile_money" || request.method === "bank_transfer") {
      if (!FLW_SECRET) {
        const updated = await rejectRequest(supabase, requestId, "Flutterwave not configured");
        return jsonResponse({ payoutRequest: updated }, 500);
      }

      const dest = (request.destination || {}) as Record<string, any>;
      const accountNumber = dest.account_number || dest.value || dest.msisdn || dest.phone || "";
      if (!accountNumber) {
        const updated = await rejectRequest(supabase, requestId, "Destination account/number missing");
        return jsonResponse({ payoutRequest: updated }, 400);
      }

      // Hardcoded MVP currency mapping. M-Pesa Kenya is the most
      // common South Sudanese diaspora rail; default everyone there
      // unless the destination specifies otherwise. Bank transfers
      // need a bank code — we can't infer one safely so fail loud
      // when the operator forgot to attach it.
      let accountBank = dest.account_bank || "";
      let currency = dest.currency || "KES";

      if (request.method === "mobile_money") {
        if (!accountBank) accountBank = "MPS"; // Safaricom M-Pesa Kenya
        if (!dest.currency) currency = "KES";
      } else {
        // bank_transfer
        if (!accountBank) {
          const updated = await rejectRequest(
            supabase,
            requestId,
            "bank_transfer requires destination.account_bank (Flutterwave bank code)",
          );
          return jsonResponse({ payoutRequest: updated }, 400);
        }
      }

      // Compute the local-currency amount. KES is hardcoded for MVP;
      // anything else uses the USD parity (100 coins = $1) on the
      // assumption the operator has confirmed Flutterwave supports
      // that rail in USD before triggering.
      const usdAmount = request.coinAmount / COINS_PER_USD;
      let amount: number;
      if (currency === "KES") {
        amount = Math.round(usdAmount * USD_TO_KES);
      } else if (currency === "USD") {
        amount = Math.round(usdAmount * 100) / 100;
      } else {
        // Unknown currency — fail loud rather than guess at FX.
        const updated = await rejectRequest(
          supabase,
          requestId,
          `Unsupported destination.currency: ${currency} (MVP supports KES, USD)`,
        );
        return jsonResponse({ payoutRequest: updated }, 400);
      }
      if (amount <= 0) {
        const updated = await rejectRequest(supabase, requestId, "Computed amount is zero");
        return jsonResponse({ payoutRequest: updated }, 400);
      }

      const reference = `payout_${requestId}_${Date.now()}`;
      const transferBody: Record<string, unknown> = {
        account_bank: accountBank,
        account_number: String(accountNumber),
        amount,
        currency,
        narration: "Junubin payout",
        reference,
        beneficiary_name: userRow.displayName || userRow.email || "Junubin Creator",
        meta: {
          junubin_payout_request_id: requestId,
          junubin_user_id: userRow.id,
        },
      };

      try {
        const result = await flwPost("/transfers", transferBody);
        const flwTransactionId = result?.data?.id;

        const merged = {
          ...(request.metadata || {}),
          provider: "flutterwave",
          transactionId: flwTransactionId,
          reference,
          amount,
          currency,
          accountBank,
        };

        // Flutterwave settles transfers asynchronously — the row
        // stays at 'processing' until the flw-webhook receives a
        // transfer.completed event and flips it to 'paid'.
        const { data: updated, error: updErr } = await supabase
          .from("PayoutRequest")
          .update({ metadata: merged })
          .eq("id", requestId)
          .select("*")
          .maybeSingle();

        if (updErr) {
          console.error("Failed to persist Flutterwave transactionId:", updErr);
          return errorResponse("Transfer initiated but DB update failed", 500);
        }
        return jsonResponse({ payoutRequest: updated });
      } catch (err) {
        const updated = await rejectRequest(supabase, requestId, (err as Error).message || "Flutterwave transfer failed");
        return jsonResponse({ payoutRequest: updated }, 502);
      }
    }

    // Unknown method — shouldn't happen because of the CHECK
    // constraint, but guard for it.
    const updated = await rejectRequest(supabase, requestId, `Unknown method: ${request.method}`);
    return jsonResponse({ payoutRequest: updated }, 400);
  } catch (err) {
    console.error("process-payout error:", err);
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});
