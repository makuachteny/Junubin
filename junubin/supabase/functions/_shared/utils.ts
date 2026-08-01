// Shared utilities for Supabase Edge Functions

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extract the app User.id from the JWT in the Authorization header.
 * Uses service_role client to look up the User table.
 */
export async function getUser(req: Request, supabase: any): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");

  // Verify the JWT and get the auth user
  const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
  if (error || !authUser) return null;

  // Look up the app User.id by auth_id
  const { data: appUser } = await supabase
    .from("User")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  return appUser?.id || null;
}

/**
 * Return a JSON error response.
 */
export function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Return a JSON success response.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Set of user ids the caller mutually follows — i.e. the caller follows
 * them AND they follow the caller. This is the audience for
 * Profile.locationVisibility = 'mutuals' (00049), and the same
 * definition of "mutual" that get_or_create_direct_conversation (00048)
 * and the client's canMessageDirectly use.
 *
 * Two set-based queries against the caller's own follow graph, then an
 * intersection in memory — never one round trip per candidate. Scoped
 * to the caller (not to the candidate list) on purpose: an `.in()`
 * filter over an unbounded candidate set would encode thousands of ids
 * into the PostgREST query string and blow the URI limit, and the
 * caller's own follow graph is the smaller side anyway.
 *
 * Requires a service-role client — Follow's SELECT policy is public
 * (00004) so an anon client would also work, but every caller of this
 * is already running with the service role.
 */
export async function getMutualFollowIds(
  supabase: any,
  callerId: string,
): Promise<Set<string>> {
  const [following, followers] = await Promise.all([
    supabase.from("Follow").select("followingId").eq("followerId", callerId),
    supabase.from("Follow").select("followerId").eq("followingId", callerId),
  ]);

  // Fail CLOSED. If either leg errored we cannot prove a relationship is
  // mutual, and the whole point of the 'mutuals' level is that an
  // unproven viewer does not get the user's area. An empty set means
  // every 'mutuals' profile is filtered out of the response.
  if (following.error || followers.error) {
    console.error(
      "getMutualFollowIds: follow graph query failed",
      following.error || followers.error,
    );
    return new Set<string>();
  }

  const iFollow = new Set<string>();
  for (const row of following.data || []) {
    if (row?.followingId) iFollow.add(row.followingId as string);
  }

  const mutual = new Set<string>();
  for (const row of followers.data || []) {
    const id = row?.followerId as string | undefined;
    if (id && iFollow.has(id)) mutual.add(id);
  }

  return mutual;
}
