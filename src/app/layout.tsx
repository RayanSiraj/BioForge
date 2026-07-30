import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "BioForge",
  description: "AI-driven plastic-degrading enzyme discovery & validation",
};

const NAV = [
  { href: "/", label: "1. Plastic" },
  { href: "/families", label: "2. Families" },
  { href: "/variants", label: "3. Variants" },
  { href: "/validation", label: "4. Validation" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-emerald-700">
                  🧬 BioForge
                </span>
              </Link>
              {user && (
                <nav className="flex items-center gap-1 text-sm">
                  {NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <form action="/auth/signout" method="post" className="ml-2">
                    <button
                      type="submit"
                      className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
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
      </body>
    </html>
  );
}
