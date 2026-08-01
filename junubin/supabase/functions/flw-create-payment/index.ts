/**
 * flw-create-payment — retired.
 *
 * JuNubin is 100% free. This endpoint remains only so an old deployed
 * client receives an explicit retired response instead of accidentally
 * opening a mobile-money payment rail.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse } from "../_shared/utils.ts";

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return errorResponse("Payments are retired. JuNubin is free.", 410);
});
