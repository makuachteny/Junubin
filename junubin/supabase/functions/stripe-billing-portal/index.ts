/**
 * stripe-billing-portal — retired.
 *
 * JuNubin is 100% free and no longer exposes paid subscriptions or a
 * customer portal. Existing Stripe subscriptions must be cancelled from
 * the Stripe dashboard; this function intentionally opens no portal.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse } from "../_shared/utils.ts";

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return errorResponse("Payments are retired. JuNubin is free.", 410);
});
