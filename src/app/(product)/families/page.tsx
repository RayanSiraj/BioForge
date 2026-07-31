"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { EnzymeFamily } from "@/lib/types";

function FamiliesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const plastic = params.get("plastic");
  const plasticName = params.get("name");

  const [families, setFamilies] = useState<EnzymeFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plastic) {
      setLoading(false);
      return;
    }
    fetch(`/api/enzyme-families?plastic=${encodeURIComponent(plastic)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setFamilies(d.families);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [plastic]);

  function select(f: EnzymeFamily) {
    router.push(
      `/variants?family=${f.id}&name=${encodeURIComponent(f.name)}`,
    );
  }

  if (!plastic) {
    return (
      <p className="text-sm text-slate-500">
        No plastic selected.{" "}
        <Link href="/" className="text-emerald-700 hover:underline">
          Go back to step 1
        </Link>
        .
      </p>
    );
  }

  return (
    <div>
      <Link href="/" className="text-sm text-emerald-700 hover:underline">
        ← Plastics
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        Enzyme families for {plasticName ?? "selected plastic"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Curated <em>starting reference</em> data — not authoritative. Pick a
        family to generate and score variants.
      </p>

      {loading && <p className="mt-6 text-slate-500">Loading…</p>}
      {error && (
        <p className="mt-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {families.map((f) => (
          <div
            key={f.id}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{f.name}</h2>
                {f.rationale && (
                  <p className="mt-1 text-sm text-slate-600">{f.rationale}</p>
                )}
                {f.source_citation && (
                  <p className="mt-2 text-xs italic text-slate-400">
                    {f.source_citation}
                  </p>
                )}
                <p className="mt-2 break-all font-mono text-xs text-slate-400">
                  ref: {f.reference_sequence.slice(0, 60)}
                  {f.reference_sequence.length > 60 ? "…" : ""} (
                  {f.reference_sequence.length} aa)
                </p>
              </div>
              <button
                onClick={() => select(f)}
                className="shrink-0 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Generate variants →
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && families.length === 0 && !error && (
        <p className="mt-6 text-sm text-slate-500">
          No families found for this plastic.
        </p>
      )}
    </div>
  );
}

export default function FamiliesPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <FamiliesInner />
    </Suspense>
  );
}
