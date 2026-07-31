"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Variant } from "@/lib/types";

interface ScoringMeta {
  model: string;
  tier: string;
  method: string;
}

function VariantsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const family = params.get("family");
  const familyName = params.get("name");

  const [variants, setVariants] = useState<Variant[]>([]);
  const [scoring, setScoring] = useState<ScoringMeta | null>(null);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Synchronous in-flight guard: state updates are async, so a rapid
  // double-click could fire two POSTs before `generating` flips. This ref
  // blocks the second call immediately.
  const generatingRef = useRef(false);

  const loadVariants = useCallback(async () => {
    if (!family) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/variants?family=${encodeURIComponent(family)}`,
      );
      const d = await r.json();
      if (d.error) setError(d.error);
      else setVariants(d.variants);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [family]);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  async function generate() {
    if (!family || generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch("/api/variants/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enzyme_family_id: family, count }),
      });
      const d = await r.json();
      if (d.error) {
        setError(d.error);
      } else {
        setScoring(d.scoring);
        await loadVariants();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
      generatingRef.current = false;
    }
  }

  async function promote(v: Variant) {
    setPromoting(v.id);
    setNotice(null);
    try {
      const r = await fetch("/api/validation-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: v.id,
          tier: 1,
          status: "pending",
          data: { promoted_from_rank: v.rank, esm2_score: v.esm2_score },
        }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else
        setNotice(
          `Promoted variant (rank ${v.rank}) into the validation pipeline at Tier 1.`,
        );
    } catch (e) {
      setError(String(e));
    } finally {
      setPromoting(null);
    }
  }

  if (!family) {
    return (
      <p className="text-sm text-slate-500">
        No family selected.{" "}
        <Link href="/app" className="text-emerald-700 hover:underline">
          Start over
        </Link>
        .
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="text-sm text-emerald-700 hover:underline"
      >
        ← Families
      </button>
      <h1 className="mt-2 text-2xl font-bold">
        Variants — {familyName ?? "selected family"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Generate point-mutation variants, score with ESM-2, rank, then promote
        the best into validation.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium">How many variants?</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-24 rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={generate}
          disabled={generating}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {generating ? "Generating & scoring…" : "Generate + score"}
        </button>
      </div>

      {scoring && (
        <p className="mt-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <strong>ESM-2 masked-marginal</strong> · {scoring.model} ({scoring.tier}{" "}
          tier) — score is the summed log-likelihood ratio vs. wild-type; higher
          is more favoured by the model.
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}{" "}
          <Link href="/app/validation" className="font-medium underline">
            Go to validation tracker →
          </Link>
        </p>
      )}
      {error && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-slate-500">Loading variants…</p>
      ) : variants.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No variants yet — generate some above.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">ESM-2 score</th>
                <th className="px-3 py-2">Sequence (preview)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{v.rank ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {v.esm2_score !== null ? v.esm2_score.toFixed(4) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {v.sequence.slice(0, 40)}…
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/app/variants/${v.id}/structure`}
                        className="rounded border border-signal-500/30 bg-signal-500/10 px-2 py-1 text-xs font-medium text-signal-700 hover:bg-signal-500/20"
                      >
                        View 3D structure →
                      </Link>
                      <button
                        onClick={() => promote(v)}
                        disabled={promoting === v.id}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {promoting === v.id ? "Promoting…" : "Promote"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function VariantsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <VariantsInner />
    </Suspense>
  );
}
