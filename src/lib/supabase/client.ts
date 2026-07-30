"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Browser-side Supabase client (uses the public anon key). Safe for use in
// client components. Auth session is persisted in cookies via @supabase/ssr.
export function createClient() {
  return createBrowserClient(env.supabaseUrl(), env.supabaseAnonKey());
}
