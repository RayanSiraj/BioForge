import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Product shell — the workflow chrome. Kept visually distinct from the
// marketing surface: no marketing content ever renders here.
const NAV = [
  { href: "/app", label: "Plastic" },
  { href: "/app/families", label: "Families" },
  { href: "/app/variants", label: "Variants" },
  { href: "/app/validation", label: "Validation" },
  { href: "/app/sweep", label: "Sweep" },
  { href: "/app/runs", label: "Runs" },
];

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold tracking-tight text-slate-900">
              Bio<span className="text-signal-600">Forge</span>
            </span>
            <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 sm:inline">
              Console
            </span>
          </Link>
          {user && (
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
              <form action="/auth/signout" method="post" className="ml-2">
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Sign out
                </button>
              </form>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
