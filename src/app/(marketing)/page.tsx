import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./_components/Reveal";
import {
  MILESTONES,
  TIERS,
  PROGRAMS,
  PIPELINE,
  STACK,
  type Status,
} from "./_data";

const STATUS_META: Record<Status, { label: string; dot: string; text: string }> =
  {
    done: { label: "Shipped", dot: "bg-signal-400", text: "text-signal-400" },
    active: {
      label: "In progress",
      dot: "bg-electron-400",
      text: "text-electron-400",
    },
    planned: { label: "Planned", dot: "bg-slate-500", text: "text-slate-400" },
  };

function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium">
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
      <span className={m.text}>{m.label}</span>
    </span>
  );
}

export default function LandingPage() {
  const shipped = MILESTONES.filter((m) => m.status === "done").length;
  const pct = Math.round((shipped / MILESTONES.length) * 100);

  return (
    <main>
      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden">
        <Image
          src="/hero.png"
          alt="Abstract render of a molecular helix structure"
          priority
          fill
          className="pointer-events-none object-cover opacity-70"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/30"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/60"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-20 sm:pt-28 lg:pb-32 lg:pt-32">
          <div className="max-w-2xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-signal-400/25 bg-signal-400/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-signal-400">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-signal-400" />
              Enzyme engineering, in silico
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Design enzymes that
              <br />
              take plastics apart.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              BioForge is a computational pipeline for discovering and
              pressure-testing plastic-degrading enzymes — from cited published
              references, through ESM scoring and on-demand structure
              prediction, to a confidence-scored verdict.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/app"
                className="group inline-flex items-center gap-2 rounded-xl bg-signal-500 px-5 py-3 font-medium text-ink-950 shadow-glow transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400"
              >
                Open the console
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                >
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <a
                href="#pipeline"
                className="rounded-xl border border-white/12 px-5 py-3 font-medium text-slate-200 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
              >
                See how it works
              </a>
            </div>

            {/* credibility strip — real tooling */}
            <div className="mt-12">
              <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
                Built on
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {STACK.map((s) => (
                  <span
                    key={s}
                    className="font-mono text-sm text-slate-400"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Pipeline ---- */}
      <section id="pipeline" className="scroll-mt-20 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <SectionKicker>The pipeline</SectionKicker>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Five steps from a plastic to a prediction.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 sm:grid-cols-2 lg:grid-cols-5">
            {PIPELINE.map((step, i) => (
              <Reveal
                key={step.k}
                delay={i * 60}
                className="group flex flex-col bg-ink-900 p-6 transition-colors hover:bg-ink-850"
              >
                <span className="font-mono text-sm text-signal-400">
                  {step.k}
                </span>
                <h3 className="mt-4 font-display text-lg font-medium text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Progress ---- */}
      <section id="progress" className="scroll-mt-20 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <Reveal className="max-w-2xl">
              <SectionKicker>Build progress</SectionKicker>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                What&apos;s live, what&apos;s next.
              </h2>
              <p className="mt-4 text-slate-400">
                A running log of the build — updated as milestones land.
              </p>
            </Reveal>
            <Reveal delay={80} className="w-full max-w-sm">
              <div className="rounded-2xl border border-white/8 bg-ink-900 p-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
                    Milestones shipped
                  </span>
                  <span className="tnum font-display text-2xl font-semibold text-white">
                    {shipped}
                    <span className="text-slate-500">/{MILESTONES.length}</span>
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-signal-600 to-signal-400"
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Build progress"
                  />
                </div>
              </div>
            </Reveal>
          </div>

          <ol className="mt-14 space-y-3">
            {MILESTONES.map((m, i) => (
              <Reveal as="li" key={m.title} delay={i * 50}>
                <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-ink-900 p-5 transition-colors hover:border-white/15 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 font-mono text-sm text-slate-600">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-medium text-white">
                        {m.title}
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
                        {m.detail}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 pl-10 sm:pl-0">
                    <StatusPill status={m.status} />
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Validation tiers ---- */}
      <section id="validation" className="scroll-mt-20 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal className="max-w-2xl">
            <SectionKicker>Validation framework</SectionKicker>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Three tiers, escalating rigor.
            </h2>
            <p className="mt-4 text-slate-400">
              Every candidate is designed to move from computation toward the
              bench. Shown here as pipeline status — not results.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {TIERS.map((t, i) => (
              <Reveal key={t.n} delay={i * 70}>
                <div className="flex h-full flex-col rounded-2xl border border-white/8 bg-ink-900 p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] font-display text-sm font-semibold text-signal-400 ring-1 ring-white/8">
                      T{t.n}
                    </span>
                    <StatusPill status={t.status} />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-medium text-white">
                    {t.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {t.method}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Programs ---- */}
      <section id="programs" className="scroll-mt-20 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal className="max-w-2xl">
            <SectionKicker>Programs</SectionKicker>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Where BioForge is being built.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {PROGRAMS.map((p, i) => (
              <Reveal key={p.name} delay={i * 70}>
                <div className="flex h-full items-center justify-between rounded-2xl border border-white/8 bg-ink-900 p-6">
                  <div>
                    <h3 className="font-display text-lg font-medium text-white">
                      {p.name}
                    </h3>
                    <p className="mt-1 font-mono text-xs uppercase tracking-wider text-slate-500">
                      {p.context}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300">
                    {p.status}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA band ---- */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal className="relative overflow-hidden rounded-3xl border border-signal-400/20 bg-gradient-to-br from-ink-850 to-ink-900 p-10 text-center sm:p-16">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-signal-500/10 blur-3xl"
              aria-hidden
            />
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Step into the console.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Pick a target plastic, match a published enzyme, and score your
              first variant.
            </p>
            <Link
              href="/app"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-signal-500 px-6 py-3 font-medium text-ink-950 shadow-glow transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400"
            >
              Open the console
            </Link>
          </Reveal>
        </div>
      </section>
    </main>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs uppercase tracking-[0.2em] text-signal-400">
      {children}
    </span>
  );
}
