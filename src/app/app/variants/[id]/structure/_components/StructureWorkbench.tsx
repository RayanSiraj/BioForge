"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StructureViewer, PLDDT_BANDS } from "@/components/StructureViewer";
import { InSilicoBadge, IN_SILICO_TOOLTIP } from "@/components/InSilicoBadge";
import { diffMutations } from "@/lib/structures";
import { classifyResidue, catalyticSiteFor } from "@/lib/activeSite";
import { perResiduePlddt } from "@/lib/pdb";
import { buildVerdict, type Verdict } from "@/lib/verdict";
import type { MutationScore } from "@/lib/esm2";

const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY".split("");
const clean = (s: string) => s.replace(/[^A-Za-z]/g, "").toUpperCase();
// Stable empty reference so a null active-site set doesn't re-init the viewer.
const NO_RESIDUES: number[] = [];

interface FoldState {
  status: "loading" | "ready" | "error" | "skipped";
  pdb?: string;
  meanPlddt?: number | null;
  message?: string;
  busy?: boolean; // transient (ESMFold service timed out) — retryable
  forSequence?: string; // which sequence this fold corresponds to
}
interface EsmState {
  status: "idle" | "loading" | "ready" | "error";
  score?: number;
  mutations?: MutationScore[];
  tier?: string;
  runId?: string | null;
  message?: string;
  forSequence?: string;
}
interface StructuralState {
  status: "idle" | "loading" | "ready" | "error";
  forSequence?: string;
  meanPlddt?: number | null;
  activeSiteRmsd?: number | null;
  activeSiteApplicable?: boolean;
  activeSiteResidues?: number[] | null;
  rmsdNote?: string | null;
  lowConfidence?: boolean;
  thresholds?: { plddtMin: number; rmsdMax: number };
  message?: string;
}

export function StructureWorkbench({
  familyId,
  parentSequence,
  parentUniprot,
  initialSequence,
}: {
  familyId: string;
  parentSequence: string;
  parentUniprot: string | null;
  initialSequence: string;
}) {
  const parent = useMemo(() => clean(parentSequence), [parentSequence]);
  const [working, setWorking] = useState(() => clean(initialSequence));

  const [parentFold, setParentFold] = useState<FoldState>({
    status: parentUniprot ? "loading" : "skipped",
  });
  const [variantFold, setVariantFold] = useState<FoldState>({
    status: "loading",
  });
  const [esm, setEsm] = useState<EsmState>({ status: "idle" });
  const [structural, setStructural] = useState<StructuralState>({
    status: "idle",
  });

  const mutations = useMemo(
    () => diffMutations(parent, working),
    [parent, working],
  );

  // --- Parent structure (once) ---
  useEffect(() => {
    if (!parentUniprot) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/structure/alphafold?uniprot=${encodeURIComponent(parentUniprot)}`,
        );
        const d = await r.json();
        if (cancelled) return;
        setParentFold(
          r.ok
            ? { status: "ready", pdb: d.pdb, meanPlddt: d.meanPlddt }
            : { status: "error", message: d.error },
        );
      } catch (e) {
        if (!cancelled) setParentFold({ status: "error", message: String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentUniprot]);

  // --- Fold a sequence with ESMFold (explicit) ---
  const foldVariant = useCallback(async (seq: string) => {
    setVariantFold({ status: "loading" });
    try {
      const r = await fetch("/api/structure/esmfold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence: seq }),
      });
      const d = await r.json();
      if (!r.ok)
        return setVariantFold({
          status: "error",
          message: d.error,
          busy: d.busy,
        });
      setVariantFold({
        status: "ready",
        pdb: d.pdb,
        meanPlddt: d.meanPlddt,
        forSequence: seq,
      });
    } catch (e) {
      setVariantFold({ status: "error", message: String(e) });
    }
  }, []);

  // --- Score a sequence with ESM-2 ---
  const scoreSeq = useCallback(
    async (seq: string, tier: "triage" | "precise") => {
      setEsm((s) => ({ ...s, status: "loading" }));
      try {
        const r = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId, sequence: seq, tier }),
        });
        const d = await r.json();
        if (!r.ok) return setEsm({ status: "error", message: d.error });
        setEsm({
          status: "ready",
          score: d.score,
          mutations: d.mutations,
          tier: d.tier,
          runId: d.runId ?? null,
          forSequence: seq,
        });
      } catch (e) {
        setEsm({ status: "error", message: String(e) });
      }
    },
    [familyId],
  );

  // --- Structural self-consistency (ESMFold + active-site RMSD) ---
  // Fires AFTER the stability score, with its own pending state; the score is
  // never blocked on it. Reuses the variant fold when it's already available.
  const runStructuralCheck = useCallback(
    async (seq: string, runId: string | null, mutantPdb?: string) => {
      setStructural({ status: "loading", forSequence: seq });
      try {
        const r = await fetch("/api/structural-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            familyId,
            sequence: seq,
            runId,
            mutantPdb,
            persistStructure: true,
          }),
        });
        const d = await r.json();
        if (!r.ok) {
          return setStructural({
            status: "error",
            forSequence: seq,
            message: d.error,
          });
        }
        setStructural({
          status: "ready",
          forSequence: seq,
          meanPlddt: d.meanPlddt ?? null,
          activeSiteRmsd: d.activeSiteRmsd ?? null,
          activeSiteApplicable: d.activeSiteApplicable,
          activeSiteResidues: d.activeSiteResidues ?? null,
          rmsdNote: d.rmsdNote ?? null,
          lowConfidence: d.lowConfidence,
          thresholds: d.thresholds,
        });
      } catch (e) {
        setStructural({ status: "error", forSequence: seq, message: String(e) });
      }
    },
    [familyId],
  );

  // Initial fold + score.
  useEffect(() => {
    foldVariant(clean(initialSequence));
    scoreSeq(clean(initialSequence), "triage");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced live re-score whenever the working sequence changes.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => scoreSeq(working, "triage"), 600);
    return () => clearTimeout(t);
  }, [working, scoreSeq]);

  // --- Editing helpers ---
  const setResidue = (pos: number, residue: string) => {
    setWorking((w) => {
      const arr = w.split("");
      arr[pos - 1] = residue;
      return arr.join("");
    });
  };
  const revert = (pos: number) => setResidue(pos, parent[pos - 1]);
  const resetAll = () => setWorking(clean(initialSequence));

  // --- Derived ---
  const foldMatches =
    variantFold.status === "ready" && variantFold.forSequence === working;
  const esmMatches = esm.status === "ready" && esm.forSequence === working;

  const plddtMap = useMemo(
    () => (foldMatches && variantFold.pdb ? perResiduePlddt(variantFold.pdb) : null),
    [foldMatches, variantFold.pdb],
  );
  const mutatedResiduePlddt = mutations.map((m) => ({
    position: m.position,
    plddt: plddtMap?.get(m.position) ?? null,
  }));

  const verdict: Verdict = buildVerdict({
    esmScore: esmMatches ? (esm.score ?? null) : null,
    mutations: esmMatches ? (esm.mutations ?? []) : [],
    meanPlddt: foldMatches ? (variantFold.meanPlddt ?? null) : null,
    mutatedResiduePlddt,
  });

  // Kick off the structural check once the score is in and the variant fold has
  // resolved (so we can reuse it). One check per distinct working sequence.
  const structuralStartedFor = useRef<string | null>(null);
  useEffect(() => {
    const foldResolved =
      variantFold.status === "ready" || variantFold.status === "error";
    if (!esmMatches || !foldResolved) return;
    if (mutations.length === 0) {
      structuralStartedFor.current = working;
      setStructural({ status: "idle", forSequence: working });
      return;
    }
    if (structuralStartedFor.current === working) return;
    structuralStartedFor.current = working;
    const mutantPdb = foldMatches ? variantFold.pdb : undefined;
    runStructuralCheck(working, esm.runId ?? null, mutantPdb);
  }, [
    esmMatches,
    foldMatches,
    variantFold,
    mutations.length,
    working,
    esm.runId,
    runStructuralCheck,
  ]);

  const structuralMatches = structural.forSequence === working;
  const highlight = mutations.map((m) => m.position);

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Left: structures */}
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <ViewerPanel
            title="Parent"
            subtitle={parentUniprot ? `AlphaFold · ${parentUniprot}` : "AlphaFold"}
            fold={parentFold}
            emptyLabel="No verified UniProt accession in AlphaFold DB for this family."
          />
          <ViewerPanel
            title="Variant"
            subtitle="ESMFold · on demand"
            fold={variantFold}
            highlight={highlight}
            activeSite={structural.activeSiteResidues ?? NO_RESIDUES}
            activeSiteLabel={
              structural.activeSiteApplicable
                ? "Ser134 · Asp180 · His211 (±2)"
                : undefined
            }
            stale={variantFold.status === "ready" && !foldMatches}
            onRefold={() => foldVariant(working)}
          />
        </div>
        <PlddtLegend />
        <VerdictPanel verdict={verdict} />
      </div>

      {/* Right: editor + scores + export */}
      <div className="space-y-4">
        <ScorePanel
          esm={esm}
          esmMatches={esmMatches}
          onPrecise={() => scoreSeq(working, "precise")}
        />
        <StructuralPanel structural={structural} stale={!structuralMatches} />
        <MutationEditor
          parent={parent}
          working={working}
          mutations={mutations}
          esmMutations={esmMatches ? esm.mutations : undefined}
          plddtMap={plddtMap}
          parentUniprot={parentUniprot}
          onSetResidue={setResidue}
          onRevert={revert}
          onReset={resetAll}
        />
        <ExportButton
          data={{
            familyId,
            parentUniprot,
            parentSequence: parent,
            sequence: working,
            mutations,
            esm: esmMatches ? esm : undefined,
            variantMeanPlddt: foldMatches ? (variantFold.meanPlddt ?? null) : null,
            verdict,
          }}
          variantPdb={foldMatches ? variantFold.pdb : undefined}
          parentPdb={parentFold.status === "ready" ? parentFold.pdb : undefined}
        />
      </div>
    </div>
  );
}

// --- Viewer panel ---------------------------------------------------------

function ViewerPanel({
  title,
  subtitle,
  fold,
  highlight,
  activeSite = [],
  activeSiteLabel,
  emptyLabel,
  stale,
  onRefold,
}: {
  title: string;
  subtitle: string;
  fold: FoldState;
  highlight?: number[];
  activeSite?: number[];
  activeSiteLabel?: string;
  emptyLabel?: string;
  stale?: boolean;
  onRefold?: () => void;
}) {
  const [showActiveSite, setShowActiveSite] = useState(true);
  const hasActiveSite = activeSite.length > 0 && fold.status === "ready";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveSite && (
            <label
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600"
              title={activeSiteLabel}
            >
              <input
                type="checkbox"
                checked={showActiveSite}
                onChange={(e) => setShowActiveSite(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#16a34a]"
              />
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#16a34a]" />
                Active site
              </span>
            </label>
          )}
          {fold.status === "ready" && fold.meanPlddt != null && (
            <span className="tnum rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              mean pLDDT {fold.meanPlddt}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-[300px] bg-slate-50">
        {fold.status === "skipped" ? (
          <Centered className="text-slate-400">{emptyLabel}</Centered>
        ) : fold.status === "loading" ? (
          <Centered>
            <Pulse />
            {title === "Variant" ? "Folding…" : "Loading…"}
          </Centered>
        ) : fold.status === "error" ? (
          <div className="grid h-full place-items-center gap-3 px-6 text-center">
            <p className={`text-sm ${fold.busy ? "text-amber-700" : "text-red-600"}`}>
              {fold.message}
            </p>
            {onRefold && (
              <button
                onClick={onRefold}
                className="rounded-md bg-signal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-signal-700"
              >
                Try fold again
              </button>
            )}
          </div>
        ) : (
          <StructureViewer
            pdb={fold.pdb!}
            highlight={highlight}
            activeSite={activeSite}
            showActiveSite={showActiveSite}
            className="h-full w-full"
          />
        )}
        {stale && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-amber-50/95 px-3 py-2 text-xs text-amber-800">
            Structure is out of date for the current edits.
            <button
              onClick={onRefold}
              className="rounded bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700"
            >
              Re-fold
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Score panel ----------------------------------------------------------

function ScorePanel({
  esm,
  esmMatches,
  onPrecise,
}: {
  esm: EsmState;
  esmMatches: boolean;
  onPrecise: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          ESM-2 masked-marginal
        </p>
        {esm.status === "loading" && <Pulse />}
      </div>
      {esm.status === "error" ? (
        <p className="mt-2 text-sm text-red-600">{esm.message}</p>
      ) : esm.status === "ready" ? (
        <>
          <p className="mt-1 tnum font-display text-3xl font-semibold text-slate-900">
            {esm.score! > 0 ? "+" : ""}
            {esm.score!.toFixed(2)}
            {!esmMatches && (
              <span className="ml-2 align-middle text-xs font-normal text-amber-600">
                recomputing…
              </span>
            )}
          </p>
          <div className="mt-1.5">
            <InSilicoBadge />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Σ log-likelihood ratio vs. wild-type · {esm.tier} tier. Higher is more
            favoured by the model.
          </p>
          <button
            onClick={onPrecise}
            disabled={esm.status !== "ready"}
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Run precise pass (ESM-2 650M)
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Scoring…</p>
      )}
    </div>
  );
}

// --- Structural self-consistency panel ------------------------------------

function StructuralPanel({
  structural: s,
  stale,
}: {
  structural: StructuralState;
  stale: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Structural self-consistency
        </p>
        {s.status === "loading" && <Pulse />}
      </div>

      {s.status === "loading" ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
          Folding mutant &amp; comparing…
          <span className="text-slate-400">(ESMFold — slower)</span>
        </p>
      ) : s.status === "error" ? (
        <p className="mt-2 text-sm text-red-600">{s.message}</p>
      ) : s.status === "ready" ? (
        <>
          {s.lowConfidence && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Low structural confidence
            </div>
          )}
          <dl className="mt-3 space-y-2.5">
            <MetricRow
              label="Structural confidence (pLDDT)"
              value={s.meanPlddt != null ? s.meanPlddt.toFixed(1) : "—"}
              flag={
                s.meanPlddt != null && s.thresholds
                  ? s.meanPlddt < s.thresholds.plddtMin
                  : false
              }
            />
            <MetricRow
              label="Active-site consistency (RMSD to wild-type)"
              value={
                s.activeSiteApplicable
                  ? s.activeSiteRmsd != null
                    ? `${s.activeSiteRmsd.toFixed(3)} Å`
                    : "—"
                  : "N/A"
              }
              sub={
                !s.activeSiteApplicable || s.activeSiteRmsd == null
                  ? (s.rmsdNote ?? undefined)
                  : undefined
              }
              flag={
                s.activeSiteRmsd != null && s.thresholds
                  ? s.activeSiteRmsd > s.thresholds.rmsdMax
                  : false
              }
            />
          </dl>
          <div className="mt-3 flex items-center justify-between">
            <InSilicoBadge />
            {stale && (
              <span className="text-xs text-amber-600">recomputing…</span>
            )}
          </div>
          {s.thresholds && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Flagged when pLDDT &lt; {s.thresholds.plddtMin} or RMSD &gt;{" "}
              {s.thresholds.rmsdMax} Å — candidates are shown regardless, not
              hidden.
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">
          Add a mutation to run the structural check against wild-type.
        </p>
      )}
    </div>
  );
}

function MetricRow({
  label,
  value,
  sub,
  flag,
}: {
  label: string;
  value: string;
  sub?: string;
  flag?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="shrink-0 text-right">
        <span
          className={`tnum font-display text-lg font-semibold ${
            flag ? "text-amber-700" : "text-slate-900"
          }`}
        >
          {value}
        </span>
        {sub && (
          <span className="mt-0.5 block max-w-[11rem] text-[10px] leading-tight text-slate-400">
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}

// --- Mutation editor ------------------------------------------------------

function MutationEditor({
  parent,
  working,
  mutations,
  esmMutations,
  plddtMap,
  parentUniprot,
  onSetResidue,
  onRevert,
  onReset,
}: {
  parent: string;
  working: string;
  mutations: { position: number; from: string; to: string }[];
  esmMutations?: MutationScore[];
  plddtMap: Map<number, number> | null;
  parentUniprot: string | null;
  onSetResidue: (pos: number, residue: string) => void;
  onRevert: (pos: number) => void;
  onReset: () => void;
}) {
  const [addPos, setAddPos] = useState("");
  const [addRes, setAddRes] = useState("A");
  const deltaOf = (pos: number) =>
    esmMutations?.find((m) => m.position === pos)?.delta;

  // Catalytic-residue warnings (verified positions only; see lib/activeSite).
  const catSite = catalyticSiteFor(parentUniprot);
  const catalyticHits = mutations.filter(
    (m) => classifyResidue(parentUniprot, m.position) === "catalytic",
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Residues ({mutations.length} mutation
            {mutations.length === 1 ? "" : "s"})
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Per-mutation Δ and pLDDT below are{" "}
            <InSilicoBadge className="gap-0.5" />
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Reset
        </button>
      </div>

      {catalyticHits.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="font-semibold">⚠ Catalytic residue mutated.</span>{" "}
          {catalyticHits.map((m) => `${m.from}${m.position}${m.to}`).join(", ")} —
          altering the catalytic machinery is expected to{" "}
          <strong>abolish activity</strong>, regardless of fold confidence.
          {catSite && (
            <span className="mt-1 block text-red-500">{catSite.note}</span>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {mutations.length === 0 && (
          <p className="text-sm text-slate-400">
            Identical to parent. Add a mutation below.
          </p>
        )}
        {mutations.map((m) => {
          const delta = deltaOf(m.position);
          const plddt = plddtMap?.get(m.position);
          const role = classifyResidue(parentUniprot, m.position);
          return (
            <div
              key={m.position}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                role === "catalytic"
                  ? "bg-red-50 ring-1 ring-red-200"
                  : role === "active-site"
                    ? "bg-amber-50 ring-1 ring-amber-200"
                    : "bg-slate-50"
              }`}
            >
              <span className="tnum font-mono text-xs font-medium text-[#B0246B]">
                {m.from}
                {m.position}
              </span>
              {role !== "other" && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    role === "catalytic"
                      ? "bg-red-600 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                  title={
                    role === "catalytic"
                      ? "Catalytic residue — mutation likely abolishes activity"
                      : "Active-site region — mutation may impair activity"
                  }
                >
                  {role === "catalytic" ? "catalytic" : "active site"}
                </span>
              )}
              <select
                value={m.to}
                onChange={(e) => onSetResidue(m.position, e.target.value)}
                className="rounded border border-slate-300 bg-white px-1.5 py-1 font-mono text-xs"
                aria-label={`Residue at position ${m.position}`}
              >
                {AMINO_ACIDS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <span className="ml-auto flex items-center gap-2 tnum font-mono text-[11px] text-slate-500">
                {delta != null && (
                  <span className={delta >= 0 ? "text-signal-700" : "text-slate-500"}>
                    Δ{delta >= 0 ? "+" : ""}
                    {delta.toFixed(2)}
                  </span>
                )}
                {plddt != null && <span>pLDDT {plddt.toFixed(0)}</span>}
              </span>
              <button
                onClick={() => onRevert(m.position)}
                className="text-slate-400 hover:text-red-600"
                aria-label={`Revert position ${m.position}`}
                title="Revert to wild-type"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <input
          type="number"
          min={1}
          max={parent.length}
          value={addPos}
          onChange={(e) => setAddPos(e.target.value)}
          placeholder="pos"
          className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
        />
        <select
          value={addRes}
          onChange={(e) => setAddRes(e.target.value)}
          className="rounded border border-slate-300 bg-white px-1.5 py-1 font-mono text-xs"
        >
          {AMINO_ACIDS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const p = parseInt(addPos, 10);
            if (p >= 1 && p <= parent.length) onSetResidue(p, addRes);
            setAddPos("");
          }}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
        >
          Set residue
        </button>
      </div>
      <p className="mt-2 font-mono text-[10px] text-slate-400">
        {working.length} aa · positions are 1-indexed on the parent sequence
      </p>
    </div>
  );
}

// --- Verdict --------------------------------------------------------------

const TONE_STYLE: Record<Verdict["tone"], { ring: string; dot: string; label: string }> = {
  favorable: { ring: "border-signal-300 bg-signal-50", dot: "bg-signal-500", label: "text-signal-800" },
  tolerated: { ring: "border-electron-400/40 bg-electron-400/10", dot: "bg-electron-500", label: "text-electron-500" },
  risky: { ring: "border-amber-300 bg-amber-50", dot: "bg-amber-500", label: "text-amber-800" },
  inconclusive: { ring: "border-slate-200 bg-slate-50", dot: "bg-slate-400", label: "text-slate-600" },
};

function VerdictPanel({ verdict }: { verdict: Verdict }) {
  const s = TONE_STYLE[verdict.tone];
  return (
    <div className={`rounded-xl border p-5 ${s.ring}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <span className={`font-mono text-[11px] uppercase tracking-wider ${s.label}`}>
          Computational verdict
        </span>
      </div>
      <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">
        {verdict.headline}
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
        {verdict.signals.map((sig, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            {sig}
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-1 border-t border-slate-200/70 pt-3">
        {verdict.caveats.map((c, i) => (
          <p key={i} className="text-xs leading-relaxed text-slate-500">
            {c}
          </p>
        ))}
      </div>
    </div>
  );
}

// --- Export ---------------------------------------------------------------

interface ExportData {
  familyId: string;
  parentUniprot: string | null;
  parentSequence: string;
  sequence: string;
  mutations: { position: number; from: string; to: string }[];
  esm?: EsmState;
  variantMeanPlddt: number | null;
  verdict: Verdict;
}

function ExportButton({
  data,
  variantPdb,
  parentPdb,
}: {
  data: ExportData;
  variantPdb?: string;
  parentPdb?: string;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("data.json", JSON.stringify(data, null, 2));
      zip.file("report.md", buildReport(data));
      zip.file("variant.fasta", `>variant\n${data.sequence}\n`);
      if (variantPdb) zip.file("variant_esmfold.pdb", variantPdb);
      if (parentPdb) zip.file("parent_alphafold.pdb", parentPdb);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bioforge-variant.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={busy}
      className="w-full rounded-xl bg-signal-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-signal-700 disabled:opacity-50"
    >
      {busy ? "Packaging…" : "Export package (.zip)"}
    </button>
  );
}

function buildReport(data: ExportData): string {
  const muts = data.mutations.map((m) => `${m.from}${m.position}${m.to}`).join(", ") || "none";
  return [
    "# BioForge variant report",
    "",
    `> In silico prediction — ${IN_SILICO_TOOLTIP}`,
    "",
    `Mutations vs parent: ${muts}`,
    `Length: ${data.sequence.length} aa`,
    `ESM-2 mean pLDDT (variant, predicted): ${data.variantMeanPlddt ?? "n/a"}`,
    "",
    `## Verdict — ${data.verdict.headline}`,
    ...data.verdict.signals.map((s) => `- ${s}`),
    "",
    "## Caveats",
    ...data.verdict.caveats.map((c) => `- ${c}`),
    "",
    "Files: variant_esmfold.pdb (predicted structure), parent_alphafold.pdb, variant.fasta, data.json.",
  ].join("\n");
}

// --- little shared bits ---------------------------------------------------

function Centered({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid h-full place-items-center px-6 text-center text-sm text-slate-500 ${className}`}>
      <span className="flex items-center gap-2">{children}</span>
    </div>
  );
}
function Pulse() {
  return <span className="h-2 w-2 animate-pulse rounded-full bg-signal-500" />;
}
function PlddtLegend() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          pLDDT
        </span>
        {PLDDT_BANDS.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: `#${b.color.toString(16).padStart(6, "0")}` }}
            />
            {b.label}
          </span>
        ))}
        <InSilicoBadge className="ml-auto" />
      </div>
    </div>
  );
}
