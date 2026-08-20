"use client";

// Standard disclosure shown next to any predicted score / confidence value:
// a muted "In silico prediction" label plus an info icon whose tooltip explains
// the value is computational, not wet-lab confirmed. This is a routine
// disclosure, not a warning — styled as secondary/muted text.
export const IN_SILICO_TOOLTIP =
  "Predicted computationally from sequence/structure models. Not confirmed by wet-lab assay.";

export function InSilicoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`group relative inline-flex items-center gap-1 align-middle ${className}`}
    >
      <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-slate-400">
        In silico prediction
      </span>
      <span
        tabIndex={0}
        role="img"
        aria-label={IN_SILICO_TOOLTIP}
        title={IN_SILICO_TOOLTIP}
        className="grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-slate-300 font-mono text-[9px] font-semibold leading-none text-slate-400"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 w-56 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {IN_SILICO_TOOLTIP}
      </span>
    </span>
  );
}
