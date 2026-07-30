import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Server-side Supabase client bound to the request cookies. Use this in
// Server Components and Route Handlers so RLS sees the authenticated user.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // called from a Server Component where cookies are read-only —
          // safe to ignore; middleware refreshes the session instead.
        }
      },
    },
  });
}

// Admin client using the service-role key. SERVER ONLY. Bypasses RLS — use
// only for trusted operations (e.g. seeding, writing scored variants).
export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
