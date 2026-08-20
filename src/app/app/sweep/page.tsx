"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  AMINO_ACIDS,
  positionSweep,
  combinationSweep,
  parsePool,
  withBeeswarmX,
  mutationLabel,
  type SweepItem,
  type SweepMutation,
} from "@/lib/sweep";

interface Family {
  id: string;
  name: string;
  uniprot_id: string | null;
  reference_sequence: string;
}

interface SweepResult {
  key: string;
  sweptValue: number;
  label: string;
  mutations: SweepMutation[];
  score: number | null;
  plddt: number | null;
  rmsd: number | null;
  status: "completed" | "failed";
  error?: string;
}

const CONCURRENCY = 5;
const MAX_ITEMS = 200;

const PETASE_UNIPROT = "A0A0K8P6T7";

const BANDS = [
  { name: "pLDDT ≥ 90", color: "#0053d6" },
  { name: "pLDDT 70–90", color: "#3aa0ff" },
  { name: "pLDDT < 70", color: "#f59e0b" },
  { name: "no structure", color: "#94a3b8" },
] as const;

function bandIndex(plddt: number | null): number {
  if (plddt == null) return 3;
  if (plddt >= 90) return 0;
  if (plddt >= 70) return 1;
  return 2;
}

export default function SweepPage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyId, setFamilyId] = useState<string>("");

  // Mode + parameters.
  const [mode, setMode] = useState<"position" | "combination">("position");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(30);
  const [identity, setIdentity] = useState<"fixed" | "all">("fixed");
  const [target, setTarget] = useState("A");
  const [poolStr, setPoolStr] = useState("");
  const [maxN, setMaxN] = useState(3);
  const [cap, setCap] = useState(60);

  // Run state.
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SweepResult[]>([]);
  const [total, setTotal] = useState(0);
  const [sweepDesc, setSweepDesc] = useState<string>("");
  const cancelRef = useRef(false);

  const family = families.find((f) => f.id === familyId) ?? null;
  const seqLen = family ? family.reference_sequence.replace(/\s/g, "").length : 0;

  useEffect(() => {
    fetch("/api/families")
      .then((r) => r.json())
      .then((d) => {
        const fams: Family[] = d.families ?? [];
        setFamilies(fams);
        const petase = fams.find((f) => f.uniprot_id === PETASE_UNIPROT);
        setFamilyId((petase ?? fams[0])?.id ?? "");
      })
      .catch(() => {});
  }, []);

  // Live preview of the planned batch.
  const pool = useMemo(
    () => (family ? parsePool(family.reference_sequence, poolStr) : { muts: [], errors: [] }),
    [family, poolStr],
  );
  const items: SweepItem[] = useMemo(() => {
    if (!family) return [];
    if (mode === "position") {
      return positionSweep(family.reference_sequence, rangeStart, rangeEnd, {
        mode: identity,
        target,
      });
    }
    return combinationSweep(family.reference_sequence, pool.muts, maxN, cap);
  }, [family, mode, rangeStart, rangeEnd, identity, target, pool.muts, maxN, cap]);

  const tooMany = items.length > MAX_ITEMS;
  const canRun = !running && !!family && items.length > 0 && !tooMany;

  function describeSweep(): string {
    if (!family) return "";
    if (mode === "position") {
      return identity === "fixed"
        ? `${family.name} · ${target}-scan, residues ${rangeStart}–${rangeEnd}`
        : `${family.name} · all-19 scan, residues ${rangeStart}–${rangeEnd}`;
    }
    return `${family.name} · combinations of ${pool.muts.length} candidate mutations (up to ${maxN})`;
  }

  async function runSweep() {
    if (!family) return;
    const batch = items;
    cancelRef.current = false;
    setRunning(true);
    setResults([]);
    setTotal(batch.length);
    setSweepDesc(describeSweep());
    const sweepId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    let idx = 0;
    const worker = async () => {
      while (idx < batch.length && !cancelRef.current) {
        const item = batch[idx++];
        const res = await scoreItem(family.id, item, sweepId);
        setResults((prev) => [...prev, res]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker),
    );
    setRunning(false);
  }

  // Stats.
  const completed = results.filter((r) => r.status === "completed" && r.score != null);
  const failed = results.filter((r) => r.status === "failed").length;
  const scores = completed.map((r) => r.score as number);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const std =
    scores.length > 1
      ? Math.sqrt(
          scores.reduce((s, x) => s + (x - (mean as number)) ** 2, 0) /
            (scores.length - 1),
        )
      : null;
  const best = completed.reduce<SweepResult | null>(
    (b, r) => (b == null || (r.score as number) > (b.score as number) ? r : b),
    null,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Sweep</h1>
      <p className="mt-1 text-sm text-slate-500">
        Run a batch experiment across many mutations — each variant flows through
        the same ESM-2 scoring and structural-consistency pipeline as a single
        prediction, so results are directly comparable.
      </p>

      {/* ---- Config ---- */}
      <div className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">Parent enzyme</span>
            <select
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              disabled={running}
              className="w-64 rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.uniprot_id ? ` · ${f.uniprot_id}` : ""}
                </option>
              ))}
            </select>
          </label>
          {family && (
            <span className="pb-2 text-xs text-slate-400">{seqLen} aa</span>
          )}
          <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-slate-300">
            {(["position", "combination"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={running}
                className={`px-3 py-1.5 text-sm font-medium ${
                  mode === m
                    ? "bg-signal-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m === "position" ? "Position scan" : "Combined mutations"}
              </button>
            ))}
          </div>
        </div>

        {mode === "position" ? (
          <div className="flex flex-wrap items-end gap-3">
            <NumField label="From residue" value={rangeStart} min={1} max={seqLen} onChange={setRangeStart} disabled={running} />
            <NumField label="To residue" value={rangeEnd} min={1} max={seqLen} onChange={setRangeEnd} disabled={running} />
            <label className="text-xs font-medium text-slate-600">
              <span className="mb-1 block">Mutant identity</span>
              <div className="inline-flex overflow-hidden rounded border border-slate-300">
                {(["fixed", "all"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setIdentity(v)}
                    disabled={running}
                    className={`px-3 py-1.5 text-sm ${
                      identity === v
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {v === "fixed" ? "Fixed residue" : "All 19"}
                  </button>
                ))}
              </div>
            </label>
            {identity === "fixed" && (
              <label className="text-xs font-medium text-slate-600">
                <span className="mb-1 block">Substitute to</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  disabled={running}
                  className="rounded border border-slate-300 px-2 py-1.5 font-mono text-sm"
                >
                  {AMINO_ACIDS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-600">
              <span className="mb-1 block">
                Candidate mutation pool (e.g. “S134A D180N T88V K95R”)
              </span>
              <textarea
                value={poolStr}
                onChange={(e) => setPoolStr(e.target.value)}
                disabled={running}
                rows={2}
                placeholder="Space- or comma-separated, e.g. S134A D180N T88V"
                className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm"
              />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <NumField label="Max mutations to combine" value={maxN} min={1} max={6} onChange={setMaxN} disabled={running} />
              <NumField label="Batch cap" value={cap} min={1} max={MAX_ITEMS} onChange={setCap} disabled={running} />
              <span className="pb-2 text-xs text-slate-500">
                {pool.muts.length} valid candidate mutation
                {pool.muts.length === 1 ? "" : "s"}
              </span>
            </div>
            {pool.errors.length > 0 && (
              <ul className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {pool.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <button
            onClick={runSweep}
            disabled={!canRun}
            className="rounded-lg bg-signal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-signal-700 disabled:opacity-50"
          >
            {running ? "Running…" : "Run sweep"}
          </button>
          {running && (
            <button
              onClick={() => (cancelRef.current = true)}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Stop
            </button>
          )}
          <span className={`text-sm ${tooMany ? "text-red-600" : "text-slate-500"}`}>
            {items.length} variant{items.length === 1 ? "" : "s"} planned
            {tooMany && ` — over the ${MAX_ITEMS} cap, narrow the range`}
            {!tooMany && items.length > 0 && !running && (
              <span className="text-slate-400">
                {" "}
                · ~{Math.ceil((items.length / CONCURRENCY) * 18)}s with structural
                checks
              </span>
            )}
          </span>
        </div>

        {running && (
          <div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>
                {results.length} / {total} done{failed ? ` · ${failed} failed` : ""}
              </span>
              <span>{Math.round((results.length / Math.max(1, total)) * 100)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-signal-500 transition-all"
                style={{ width: `${(results.length / Math.max(1, total)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ---- Results ---- */}
      {results.length > 0 && (
        <ResultsView
          results={results}
          completedCount={completed.length}
          failed={failed}
          total={total}
          mean={mean}
          std={std}
          best={best}
          mode={mode}
          desc={sweepDesc}
        />
      )}
    </div>
  );
}

// --- one item = existing single-mutation pipeline (score + structural) -------

async function scoreItem(
  familyId: string,
  item: SweepItem,
  sweepId: string,
): Promise<SweepResult> {
  const base: Omit<SweepResult, "status"> = {
    key: item.key,
    sweptValue: item.sweptValue,
    label: item.label,
    mutations: item.mutations,
    score: null,
    plddt: null,
    rmsd: null,
  };
  try {
    const r = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyId,
        sequence: item.sequence,
        tier: "triage",
        sweepId,
      }),
    });
    const d = await r.json();
    if (!r.ok) return { ...base, status: "failed", error: d.error };
    base.score = d.score;

    // Structural consistency (optional — its failure doesn't fail the item).
    // ESMFold via ESM Atlas can 504 transiently under concurrency, so retry once.
    if (d.runId) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const sr = await fetch("/api/structural-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              familyId,
              sequence: item.sequence,
              runId: d.runId,
            }),
          });
          const sd = await sr.json();
          if (sr.ok) {
            base.plddt = sd.meanPlddt ?? null;
            base.rmsd = sd.activeSiteRmsd ?? null;
            break;
          }
        } catch {
          /* fall through to retry / leave null */
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { ...base, status: "completed" };
  } catch (e) {
    return { ...base, status: "failed", error: String(e) };
  }
}

// --- Results view (stats + chart + CSV) -------------------------------------

function ResultsView({
  results,
  completedCount,
  failed,
  total,
  mean,
  std,
  best,
  mode,
  desc,
}: {
  results: SweepResult[];
  completedCount: number;
  failed: number;
  total: number;
  mean: number | null;
  std: number | null;
  best: SweepResult | null;
  mode: "position" | "combination";
  desc: string;
}) {
  const xLabel = mode === "position" ? "Residue position" : "Number of mutations";

  // Chart data: completed points, colored by pLDDT band, beeswarm-spread on x.
  const points = withBeeswarmX(
    results
      .filter((r) => r.status === "completed" && r.score != null)
      .map((r) => ({
        sweptValue: r.sweptValue,
        score: r.score as number,
        plddt: r.plddt,
        rmsd: r.rmsd,
        label: r.label,
      })),
  );
  const banded = BANDS.map((_, bi) => points.filter((p) => bandIndex(p.plddt) === bi));
  const xTicks = [...new Set(points.map((p) => p.sweptValue))].sort((a, b) => a - b);

  function exportCsv() {
    const headers = [
      mode === "position" ? "residue_position" : "num_mutations",
      "mutations",
      "predicted_score",
      "structural_confidence_plddt",
      "active_site_rmsd",
      "status",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of results) {
      lines.push(
        [r.sweptValue, r.label, r.score ?? "", r.plddt ?? "", r.rmsd ?? "", r.status]
          .map(esc)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sweep-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Mean score" value={mean != null ? mean.toFixed(3) : "—"} />
        <StatTile label="Std dev" value={std != null ? std.toFixed(3) : "—"} />
        <StatTile
          label="Best score"
          value={best ? (best.score as number).toFixed(3) : "—"}
          sub={best ? best.label : undefined}
        />
        <StatTile
          label="Completed / failed"
          value={`${completedCount} / ${failed}`}
          sub={`of ${total} planned`}
        />
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Predicted stability across the sweep
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
          </div>
          <button
            onClick={exportCsv}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-4 h-[440px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 28, bottom: 40, left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="x"
                ticks={xTicks.length <= 24 ? xTicks : undefined}
                domain={["dataMin - 1", "dataMax + 1"]}
                tickFormatter={(v) => `${Math.round(v)}`}
                allowDecimals={false}
                stroke="#64748b"
                tick={{ fontSize: 12, fill: "#475569" }}
                label={{
                  value: xLabel,
                  position: "insideBottom",
                  offset: -18,
                  style: { fontSize: 13, fill: "#334155", fontWeight: 600 },
                }}
              />
              <YAxis
                type="number"
                dataKey="score"
                stroke="#64748b"
                tick={{ fontSize: 12, fill: "#475569" }}
                label={{
                  value: "Predicted ΔLL score (ESM-2 masked-marginal)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 4,
                  style: {
                    fontSize: 13,
                    fill: "#334155",
                    fontWeight: 600,
                    textAnchor: "middle",
                  },
                }}
              />
              <ZAxis range={[70, 70]} />
              <ReferenceLine
                y={0}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{
                  value: "wild-type",
                  position: "right",
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
              />
              <Tooltip content={<SweepTooltip />} cursor={{ strokeDasharray: "3 3" }} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              {BANDS.map((b, bi) =>
                banded[bi].length > 0 ? (
                  <Scatter
                    key={b.name}
                    name={b.name}
                    data={banded[bi]}
                    fill={b.color}
                    fillOpacity={0.82}
                  />
                ) : null,
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-xs text-slate-400">
          Each point is one scored variant. Colour = ESMFold structural confidence
          (pLDDT). Points at the same x are spread horizontally to show the
          distribution. Higher score = more favoured vs. wild-type.
        </p>
      </div>
    </div>
  );
}

function SweepTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-mono font-semibold text-slate-800">{p.label}</div>
      <div className="mt-1 text-slate-600">
        Score: <span className="font-medium">{p.score.toFixed(3)}</span>
      </div>
      <div className="text-slate-600">
        pLDDT: {p.plddt != null ? p.plddt.toFixed(1) : "—"}
      </div>
      <div className="text-slate-600">
        Active-site RMSD: {p.rmsd != null ? `${p.rmsd.toFixed(3)} Å` : "—"}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 tnum font-display text-2xl font-semibold text-slate-900">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{sub}</p>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-medium text-slate-600">
      <span className="mb-1 block">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}
