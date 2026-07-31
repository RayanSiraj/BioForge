"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { EnzymeFamily } from "@/lib/types";

interface Candidate {
  accession: string;
  name: string;
  organism: string | null;
  length: number | null;
  reviewed: boolean;
}

function FamiliesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const plastic = params.get("plastic");
  const plasticName = params.get("name") ?? plastic;

  const [curated, setCurated] = useState<EnzymeFamily[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCurated, setLoadingCurated] = useState(true);
  const [loadingUniprot, setLoadingUniprot] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adopting, setAdopting] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!plastic) return;
    setLoadingCurated(true);
    setLoadingUniprot(true);
    setError(null);

    // Curated references. A 404 just means this plastic isn't in our curated
    // set — that's expected for free-text targets, not an error.
    fetch(`/api/enzyme-families?plastic=${encodeURIComponent(plastic)}`)
      .then((r) => (r.ok ? r.json() : { families: [] }))
      .then((d) => setCurated(d.families ?? []))
      .catch(() => setCurated([]))
      .finally(() => setLoadingCurated(false));

    // Live UniProtKB candidates for any plastic.
    fetch(`/api/uniprot/search?plastic=${encodeURIComponent(plastic)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCandidates(d.candidates ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingUniprot(false));
  }, [plastic]);

  useEffect(() => {
    load();
  }, [load]);

  function selectCurated(f: EnzymeFamily) {
    router.push(
      `/app/variants?family=${f.id}&name=${encodeURIComponent(f.name)}`,
    );
  }

  async function adopt(c: Candidate) {
    if (!plastic) return;
    setAdopting(c.accession);
    setError(null);
    try {
      const r = await fetch("/api/enzyme-families/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plastic, accession: c.accession }),
      });
      const d = await r.json();
      if (d.error) {
        setError(d.error);
        return;
      }
      router.push(
        `/app/variants?family=${d.family.id}&name=${encodeURIComponent(d.family.name)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdopting(null);
    }
  }

  if (!plastic) {
    return (
      <p className="text-sm text-slate-500">
        No plastic selected.{" "}
        <Link href="/app" className="text-signal-700 hover:underline">
          Start over
        </Link>
        .
      </p>
    );
  }

  return (
    <div>
      <Link href="/app" className="text-sm text-signal-700 hover:underline">
        ← Search
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        Enzyme candidates for {plasticName}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Pick a reference enzyme to generate and score point-mutation variants
        from.
      </p>

      {error && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ---- Curated references ---- */}
      {(loadingCurated || curated.length > 0) && (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">
              Curated references
            </h2>
            <span className="rounded-full bg-signal-500/10 px-2 py-0.5 text-[11px] font-medium text-signal-700">
              published · cited
            </span>
          </div>

          {loadingCurated ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="mt-3 space-y-3">
              {curated.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{f.name}</h3>
                      {f.rationale && (
                        <p className="mt-1 text-sm text-slate-600">
                          {f.rationale}
                        </p>
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
                      onClick={() => selectCurated(f)}
                      className="shrink-0 rounded bg-signal-600 px-3 py-2 text-sm font-medium text-white hover:bg-signal-700"
                    >
                      Generate variants →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---- UniProtKB candidates ---- */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            UniProtKB candidates
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            real sequences · unvetted
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Live search of UniProtKB for enzymes associated with “{plasticName}”.
          Sequences and accessions are real; the link to degradation is not
          vetted — computational triage only.
        </p>

        {loadingUniprot ? (
          <p className="mt-3 text-sm text-slate-500">Searching UniProtKB…</p>
        ) : candidates.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No UniProt hits for “{plasticName}”. Try the polymer’s chemical name
            (e.g. “polystyrene” instead of a brand name).
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {candidates.map((c) => (
              <div
                key={c.accession}
                className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{c.name}</h3>
                    {c.reviewed && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                        reviewed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.organism && (
                      <span className="italic">{c.organism}</span>
                    )}
                    {c.organism && " · "}
                    <span className="font-mono">{c.accession}</span>
                    {c.length != null && ` · ${c.length} aa`}
                  </p>
                </div>
                <button
                  onClick={() => adopt(c)}
                  disabled={adopting !== null}
                  className="shrink-0 rounded border border-signal-500/40 bg-signal-500/10 px-3 py-2 text-sm font-medium text-signal-700 transition hover:bg-signal-500/20 disabled:opacity-50"
                >
                  {adopting === c.accession
                    ? "Loading…"
                    : "Use this enzyme →"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
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
