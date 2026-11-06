// Edge Function: trending
// Ported from backend/src/routes/currentlyInto.js
// Returns trending "Currently Into" items + curated South Sudanese suggestions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUser, errorResponse, jsonResponse } from "../_shared/utils.ts";

const CURATED_SUGGESTIONS = [
  "South Sudanese music",
  "Juba nightlife",
  "Wrestling",
  "Traditional cooking",
  "Asida nights",
  "Diaspora meetups",
  "Cultural fashion",
  "Gospel music",
  "Afrobeats",
  "Sunday church",
  "Nile sunsets",
  "Community events",
  "Sudanese tea",
  "Family cookout",
  "Junub pride",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = await getUser(req, supabase);
    if (!userId) return errorResponse("Unauthorized", 401);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch active users' currentlyInto arrays
    // Join through User to check lastActiveAt and isActive
    const { data: profiles, error } = await supabase
      .from("Profile")
      .select("currentlyInto, user:User!inner(lastActiveAt, isActive)")
      .not("currentlyInto", "is", null)
      .gte("user.lastActiveAt", sevenDaysAgo.toISOString())
      .eq("user.isActive", true);

    if (error) return errorResponse(error.message, 500);

    // Count frequency of each item
    const freq: Record<string, number> = {};
    for (const p of profiles || []) {
      const items = Array.isArray(p.currentlyInto) ? p.currentlyInto : [];
      for (const item of items) {
        if (typeof item === "string" && item.trim()) {
          const key = item.trim();
          freq[key] = (freq[key] || 0) + 1;
        }
      }
    }

    // Sort by frequency descending, take top 20
    const trending = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([item, count]) => ({ item, count }));

    // Merge curated suggestions (add any not already trending)
    const trendingItems = new Set(trending.map((t) => t.item.toLowerCase()));
    const suggestions = CURATED_SUGGESTIONS.filter(
      (s) => !trendingItems.has(s.toLowerCase())
    );

    return jsonResponse({ trending, suggestions });
  } catch (err: any) {
    return errorResponse(err.message || "Internal error", 500);
  }
});
