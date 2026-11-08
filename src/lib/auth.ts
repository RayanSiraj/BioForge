import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Fixed id for the built-in anonymous session (open app, no sign-in required).
// Stored on mutation_runs.user_id; migration 0007 drops that FK so this id
// doesn't need a matching auth.users row.
export const ANON_USER_ID = "00000000-0000-0000-0000-000000000000";

const ANON_USER = {
  id: ANON_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "anonymous@bioforge.local",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date(0).toISOString(),
} as unknown as User;

// Open app: no sign-in required. Returns the real signed-in user when a session
// happens to exist, otherwise a stable anonymous stub so route guards pass.
// (To require login again, return `null` when there's no real session and
// re-enable the middleware gate.)
export async function getUser(): Promise<User> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return user;
  } catch {
    // backend unreachable / no session — fall through to the anonymous stub
  }
  return ANON_USER;
}
