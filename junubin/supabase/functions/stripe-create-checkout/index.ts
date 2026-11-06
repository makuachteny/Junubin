/**
 * stripe-create-checkout — retired.
 *
 * JuNubin is 100% free. No screen should call this function, and this
 * server-side guard makes old clients or manual requests unable to
 * create a paid checkout session.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse } from "../_shared/utils.ts";

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return errorResponse("Payments are retired. JuNubin is free.", 410);
});
