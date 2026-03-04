// This file is deprecated — all API calls now go through the Supabase client.
// See src/config/supabase.js for the Supabase client initialization.
// Kept as a stub to avoid breaking any remaining imports during migration.

export async function apiRequest() {
  throw new Error(
    'apiRequest is deprecated. Use Supabase client from src/config/supabase.js instead.'
  );
}
