import Link from "next/link";
import { MILESTONES, TIERS, PROGRAMS, PIPELINE, type Status } from "./_data";
import { Hero, InView, StatBar, Stagger, StaggerItem } from "./_components/motion";

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
    <main className="relative">
      {/* ambient depth — low, drifting glows so sections aren't flat near-black */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[70vh] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-electron-500/[0.06] blur-[140px]" />
        <div className="absolute -left-40 top-[150vh] h-[34rem] w-[34rem] rounded-full bg-signal-500/[0.05] blur-[140px]" />
        <div className="absolute -right-40 top-[230vh] h-[34rem] w-[34rem] rounded-full bg-electron-500/[0.05] blur-[140px]" />
      </div>

      <div className="relative">
        <Hero />

        {/* ---- Pipeline ---- */}
        <section id="pipeline" className="scroll-mt-20 border-t border-white/5">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <InView>
              <SectionKicker>The pipeline</SectionKicker>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Five steps from a plastic to a prediction.
              </h2>
            </InView>
            <Stagger className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 sm:grid-cols-2 lg:grid-cols-5">
              {PIPELINE.map((step) => (
                <StaggerItem
                  key={step.k}
                  className="flex flex-col bg-ink-900 p-6 transition-colors duration-300 hover:bg-ink-850"
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
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* ---- Progress ---- */}
        <section id="progress" className="scroll-mt-20 border-t border-white/5">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <InView className="max-w-2xl">
                <SectionKicker>Build progress</SectionKicker>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  What&apos;s live, what&apos;s next.
                </h2>
                <p className="mt-4 text-slate-400">
                  A running log of the build — updated as milestones land.
                </p>
              </InView>
              <InView delay={80} className="w-full max-w-sm">
                <div className="rounded-2xl border border-white/8 bg-ink-900 p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
                      Milestones shipped
                    </span>
                    <span className="tnum font-display text-2xl font-semibold text-white">
                      {shipped}
                      <span className="text-slate-500">
                        /{MILESTONES.length}
                      </span>
                    </span>
                  </div>
                  <StatBar pct={pct} />
                </div>
              </InView>
            </div>

            <Stagger className="mt-14 space-y-3">
              {MILESTONES.map((m, i) => (
                <StaggerItem as="li" key={m.title} className="list-none">
                  <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-ink-900 p-5 transition-colors duration-300 hover:border-white/15 sm:flex-row sm:items-center sm:justify-between">
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
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* ---- Validation tiers ---- */}
        <section id="validation" className="scroll-mt-20 border-t border-white/5">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <InView className="max-w-2xl">
              <SectionKicker>Validation framework</SectionKicker>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Three tiers, escalating rigor.
              </h2>
              <p className="mt-4 text-slate-400">
                Every candidate is designed to move from computation toward the
                bench. Shown here as pipeline status — not results.
              </p>
            </InView>
            <Stagger className="mt-14 grid gap-4 md:grid-cols-3" gap={0.12}>
              {TIERS.map((t) => (
                <StaggerItem key={t.n}>
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
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* ---- Programs ---- */}
        <section id="programs" className="scroll-mt-20 border-t border-white/5">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <InView className="max-w-2xl">
              <SectionKicker>Programs</SectionKicker>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Where BioForge is being built.
              </h2>
            </InView>
            <Stagger className="mt-14 grid gap-4 sm:grid-cols-3">
              {PROGRAMS.map((p) => (
                <StaggerItem key={p.name}>
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
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* ---- CTA band ---- */}
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <InView className="relative overflow-hidden rounded-3xl border border-signal-400/20 bg-gradient-to-br from-ink-850 to-ink-900 p-10 text-center sm:p-16">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-signal-500/10 blur-3xl"
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
            </InView>
          </div>
        </section>
      </div>
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
