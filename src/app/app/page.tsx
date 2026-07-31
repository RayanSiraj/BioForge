"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Plastic } from "@/lib/types";

export default function PlasticPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [common, setCommon] = useState<Plastic[]>([]);

  // Curated targets still make handy quick-picks alongside free-text search.
  useEffect(() => {
    fetch("/api/plastics")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setCommon(d.plastics ?? []);
      })
      .catch(() => {});
  }, []);

  function go(term: string) {
    const t = term.trim();
    if (!t) return;
    router.push(
      `/app/families?plastic=${encodeURIComponent(t)}&name=${encodeURIComponent(t)}`,
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">What plastic are you targeting?</h1>
      <p className="mt-1 text-sm text-slate-500">
        Search any plastic — we pull real candidate degrading enzymes from
        UniProtKB, and show curated published references where we have them.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(query);
        }}
        className="mt-6 flex gap-2"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. polystyrene, nylon-6, PET, polylactic acid…"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-signal-500 focus:outline-none focus:ring-2 focus:ring-signal-500/20"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="shrink-0 rounded-lg bg-signal-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-signal-700 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {common.length > 0 && (
        <div className="mt-6">
          <p className="font-mono text-xs uppercase tracking-wider text-slate-400">
            Curated targets
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {common.map((p) => (
              <button
                key={p.id}
                onClick={() => go(p.name)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-signal-400 hover:bg-signal-500/5"
                title={p.common_name ?? undefined}
              >
                <span className="font-medium">{p.name}</span>
                {p.common_name && (
                  <span className="ml-1.5 text-xs text-slate-400">
                    {p.common_name}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
