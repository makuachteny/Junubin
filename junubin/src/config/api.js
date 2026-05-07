// Supabase configuration — replaces the Express API base URL.
// Credentials are loaded from environment variables set via EAS secrets.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
