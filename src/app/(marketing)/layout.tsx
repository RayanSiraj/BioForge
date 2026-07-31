import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BioForge — Computational enzyme engineering for plastics",
  description:
    "BioForge is a computational pipeline for discovering and pressure-testing plastic-degrading enzymes: cited references, ESM scoring, on-demand structure prediction, and a confidence-scored verdict.",
};

const NAV = [
  { href: "#pipeline", label: "Pipeline" },
  { href: "#progress", label: "Progress" },
  { href: "#validation", label: "Validation" },
  { href: "#programs", label: "Programs" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-ink-950 text-slate-200 selection:bg-signal-400/30">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              Bio<span className="text-signal-400">Forge</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-white/10 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-white/5"
            >
              Open console
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display font-medium text-slate-300">
              BioForge
            </span>
          </div>
          <p className="text-center sm:text-right">
            Computational predictions, not guarantees. A research prototype.
          </p>
        </div>
      </footer>
    </div>
  );
}

function LogoMark() {
  return (
    <span
      aria-hidden
      className="relative grid h-7 w-7 place-items-center rounded-lg bg-signal-400/10 ring-1 ring-signal-400/30"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M4 2c0 3 8 3 8 6s-8 3-8 6M12 2c0 3-8 3-8 6s8 3 8 6"
          stroke="#34E5B0"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
