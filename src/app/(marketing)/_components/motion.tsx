"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { STACK } from "../_data";

// Shared spring — a little weight, no bounce, so motion feels engineered.
const SPRING = { type: "spring", stiffness: 120, damping: 20, mass: 0.6 } as const;

// ---------------------------------------------------------------------------
// Scroll progress — a hairline that tracks reading position.
// ---------------------------------------------------------------------------
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      aria-hidden
      style={{ scaleX: scrollYProgress }}
      className="fixed inset-x-0 top-0 z-50 h-px origin-left bg-gradient-to-r from-signal-500 via-signal-400 to-electron-400"
    />
  );
}

// ---------------------------------------------------------------------------
// In-view reveal — a short, sprung rise. Tasteful, not dramatic.
// ---------------------------------------------------------------------------
export function InView({
  children,
  delay = 0,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ ...SPRING, delay: delay / 1000 }}
    >
      {children}
    </MotionTag>
  );
}

// ---------------------------------------------------------------------------
// Hero — the signature moment: parallax depth + an orchestrated load sequence.
// ---------------------------------------------------------------------------
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};
const riseItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: SPRING },
};
const lineItem: Variants = {
  hidden: { y: "115%" },
  show: { y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } },
};

export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  // Parallax: image drifts down slower than the page; glow drifts the other way.
  const imgY = useTransform(scrollY, [0, 700], [0, 140]);
  const glowY = useTransform(scrollY, [0, 700], [0, -90]);
  const imgScale = useTransform(scrollY, [0, 700], [1, 1.08]);

  return (
    <section ref={ref} className="relative overflow-hidden">
      {/* parallax molecular field */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={reduce ? undefined : { y: imgY, scale: imgScale }}
      >
        <Image
          src="/hero.png"
          alt=""
          priority
          fill
          className="pointer-events-none object-cover object-right opacity-70"
          sizes="100vw"
        />
      </motion.div>

      {/* ambient glow that drifts against the scroll */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-[32rem] w-[32rem] rounded-full bg-signal-500/15 blur-[120px]"
        style={reduce ? undefined : { y: glowY }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/20"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/50"
      />

      <motion.div
        variants={reduce ? undefined : container}
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? undefined : "show"}
        className="relative mx-auto flex min-h-[86vh] max-w-6xl flex-col justify-center px-5 py-28"
      >
        <div className="max-w-2xl">
          <motion.span
            variants={riseItem}
            className="inline-flex items-center gap-2 rounded-full border border-signal-400/25 bg-signal-400/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-signal-400"
          >
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-signal-400" />
            Enzyme engineering, in silico
          </motion.span>

          <h1 className="mt-6 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl">
            <span className="block overflow-hidden pb-1">
              <motion.span variants={lineItem} className="block">
                Design enzymes that
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-1">
              <motion.span variants={lineItem} className="block">
                take plastics apart.
              </motion.span>
            </span>
          </h1>

          <motion.p
            variants={riseItem}
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300"
          >
            A computational pipeline for discovering and pressure-testing
            plastic-degrading enzymes — from cited published references, through
            ESM scoring and on-demand structure prediction, to a
            confidence-scored verdict.
          </motion.p>

          <motion.div
            variants={riseItem}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-xl bg-signal-500 px-5 py-3 font-medium text-ink-950 shadow-glow transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400"
            >
              Open the console
            </Link>
            <Link
              href="/methods"
              className="rounded-xl border border-white/12 px-5 py-3 font-medium text-slate-200 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            >
              See how it works
            </Link>
          </motion.div>

          <motion.div variants={riseItem} className="mt-14">
            <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
              Built on
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {STACK.map((s) => (
                <span key={s} className="font-mono text-sm text-slate-400">
                  {s}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Progress bar that fills to its value when scrolled into view.
// ---------------------------------------------------------------------------
export function StatBar({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-signal-600 to-signal-400"
        initial={reduce ? false : { width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true, margin: "0px 0px -20% 0px" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Build progress"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staggered group — children rise in sequence as the group enters view.
// ---------------------------------------------------------------------------
export function Stagger({
  children,
  className = "",
  gap = 0.07,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduce ? undefined : { show: { transition: { staggerChildren: gap } } }}
      initial={reduce ? undefined : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const MotionTag = motion[as];
  return (
    <MotionTag variants={riseItem} className={className}>
      {children}
    </MotionTag>
  );
}
