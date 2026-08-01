/**
 * discover — retired swipe-deck endpoint.
 *
 * The current JuNubin app is a free social directory/map product. It
 * uses `directory` and `discover-nearby`; this old swipe-era endpoint
 * is intentionally inert so no boost, spotlight, or dating-deck logic
 * can be revived by an old client.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse } from "../_shared/utils.ts";

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return errorResponse("This discovery endpoint is retired. Use directory or discover-nearby.", 410);
});
