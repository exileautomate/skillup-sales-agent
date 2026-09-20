import "server-only";

import { getRequiredServerEnv } from "@/config/env";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for server-side application code.
 *
 * This client is intentionally unauthenticated: session persistence and token
 * refresh are disabled until a future module introduces Supabase Auth.
 */
export function createSupabaseServerClient() {
  return createClient(
    getRequiredServerEnv("SUPABASE_URL"),
    getRequiredServerEnv("SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
