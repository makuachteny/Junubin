/**
 * flw-webhook — retired.
 *
 * JuNubin is 100% free. The endpoint acknowledges old Flutterwave
 * events to avoid retries, but it never records payments, settles paid
 * features, or grants premium state.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/utils.ts";

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return jsonResponse({
    received: true,
    ignored: true,
    reason: "Payments are retired. JuNubin is free.",
  });
});
