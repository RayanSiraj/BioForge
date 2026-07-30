import { createClient } from "@/lib/supabase/server";

// Returns the authenticated user, or null. Route handlers use this to gate
// mutations (middleware already protects pages, but API routes are excluded
// from the redirect so they enforce auth themselves).
export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
