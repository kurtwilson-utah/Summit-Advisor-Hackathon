import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./config.js";

export function createSupabaseAdminClient(): SupabaseClient {
  let realClient: SupabaseClient | null = null;

  const getOrCreate = () => {
    if (realClient) {
      return realClient;
    }

    if (!env.SUPABASE_URL) {
      throw new Error("SUPABASE_URL is required for admin operations.");
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations.");
    }

    realClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    return realClient;
  };

  return new Proxy({} as SupabaseClient, {
    get(_target, prop, receiver) {
      const client = getOrCreate();
      const value = Reflect.get(client, prop, receiver);
      return typeof value === "function" ? value.bind(client) : value;
    }
  });
}
