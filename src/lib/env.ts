// Centralised environment access with clear errors. Never hardcode secrets;
// everything comes from process.env (see .env.local.example).
//
// IMPORTANT: NEXT_PUBLIC_* vars are inlined into the client bundle by Next only
// when referenced *statically* (e.g. process.env.NEXT_PUBLIC_SUPABASE_URL).
// A dynamic lookup like process.env[name] is NOT inlined and reads as undefined
// in the browser — so the public getters below use static references.

function ensure(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy .env.local.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  // Public — safe on client. Static references so Next can inline them.
  supabaseUrl: () =>
    ensure("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    ensure(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),

  // Server-only. Do not read this from client components.
  supabaseServiceRoleKey: () =>
    ensure("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),

  // Optional — ESM-2 module falls back to a local mock when absent.
  hfApiToken: () => process.env.HF_API_TOKEN ?? null,
  esm2Model: () => process.env.ESM2_MODEL ?? "facebook/esm2_t6_8M_UR50D",
};
