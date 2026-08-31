"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client, for the two things that only make sense
 * client-side: setting a password directly (change-password re-verifies
 * the current one, forgot-password lands here from an emailed link) and
 * requesting a reset email. @supabase/ssr's browser client stores the
 * session in cookies — the same place src/lib/server/supabase.ts's
 * getSupabaseServerClient() reads from — so a password change here is
 * immediately visible server-side too, with no extra plumbing.
 *
 * Module-level singleton: createBrowserClient shouldn't be re-instantiated
 * on every call/render.
 */
let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.");
    }
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
