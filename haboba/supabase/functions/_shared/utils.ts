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
