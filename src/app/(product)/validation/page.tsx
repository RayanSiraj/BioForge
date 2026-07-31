"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TIER_LABELS,
  type ValidationRecord,
  type ValidationStatus,
  type ValidationTier,
} from "@/lib/types";

const TIERS: ValidationTier[] = [1, 2, 3];
const STATUSES: ValidationStatus[] = ["pending", "passed", "failed"];

const STATUS_STYLE: Record<ValidationStatus, string> = {
  pending: "bg-slate-100 text-slate-600",
  passed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

export default function ValidationPage() {
  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/validation-records");
      const d = await r.json();
      if (d.error) setError(d.error);
      else setRecords(d.records);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // group records by variant_id
  const byVariant = useMemo(() => {
    const map = new Map<string, Map<ValidationTier, ValidationRecord>>();
    for (const rec of records) {
      if (!map.has(rec.variant_id)) map.set(rec.variant_id, new Map());
      map.get(rec.variant_id)!.set(rec.tier, rec);
    }
    return map;
  }, [records]);

  async function updateStatus(rec: ValidationRecord, status: ValidationStatus) {
    setBusy(rec.id);
    try {
      const r = await fetch("/api/validation-records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rec.id, status }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else await load();
    } finally {
      setBusy(null);
    }
  }

  async function startTier(variantId: string, tier: ValidationTier) {
    setBusy(`${variantId}-${tier}`);
    try {
      const r = await fetch("/api/validation-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId, tier, status: "pending" }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Validation tracker</h1>
      <p className="mt-1 text-sm text-slate-500">
        Each promoted variant moves through three tiers. Update status as data
        comes in.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        {TIERS.map((t) => (
          <span key={t}>
            <strong>Tier {t}:</strong> {TIER_LABELS[t]}
          </span>
        ))}
      </div>

      {loading && <p className="mt-6 text-slate-500">Loading…</p>}
      {error && (
        <p className="mt-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && byVariant.size === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          No variants in the pipeline yet. Promote one from the{" "}
          <Link href="/" className="text-emerald-700 hover:underline">
            variants screen
          </Link>
          .
        </p>
      )}

      <div className="mt-6 space-y-4">
        {[...byVariant.entries()].map(([variantId, tiers]) => (
          <div
            key={variantId}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <p className="mb-3 font-mono text-xs text-slate-400">
              variant {variantId}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {TIERS.map((tier) => {
                const rec = tiers.get(tier);
                return (
                  <div
                    key={tier}
                    className="rounded border border-slate-200 p-3"
                  >
                    <div className="mb-2 text-sm font-semibold">
                      Tier {tier}
                      <span className="ml-1 font-normal text-slate-400">
                        {TIER_LABELS[tier]}
                      </span>
                    </div>
                    {rec ? (
                      <div className="space-y-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[rec.status]}`}
                        >
                          {rec.status}
                        </span>
                        <select
                          value={rec.status}
                          disabled={busy === rec.id}
                          onChange={(e) =>
                            updateStatus(
                              rec,
                              e.target.value as ValidationStatus,
                            )
                          }
                          className="block w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {rec.data && Object.keys(rec.data).length > 0 && (
                          <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-[10px] text-slate-500">
                            {JSON.stringify(rec.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => startTier(variantId, tier)}
                        disabled={busy === `${variantId}-${tier}`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Start tier {tier}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
