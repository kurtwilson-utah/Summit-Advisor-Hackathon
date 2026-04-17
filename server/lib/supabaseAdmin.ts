import { createClient } from "@supabase/supabase-js";
import { env } from "./config";

export function createSupabaseAdminClient() {
  if (!env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is required for admin operations.");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations.");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
