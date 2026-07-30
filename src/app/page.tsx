"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Plastic } from "@/lib/types";

export default function PlasticPage() {
  const router = useRouter();
  const [plastics, setPlastics] = useState<Plastic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plastics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setPlastics(d.plastics);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  function select(p: Plastic) {
    router.push(`/families?plastic=${p.id}&name=${encodeURIComponent(p.name)}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Select a target plastic</h1>
      <p className="mt-1 text-sm text-slate-500">
        Choose the plastic you want to find degrading enzymes for.
      </p>

      {loading && <p className="mt-6 text-slate-500">Loading…</p>}
      {error && (
        <p className="mt-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {plastics.map((p) => (
          <button
            key={p.id}
            onClick={() => select(p)}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-400 hover:shadow-sm"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold">{p.name}</span>
              <span className="text-xs text-slate-400">{p.common_name}</span>
            </div>
            {p.notes && (
              <p className="mt-2 text-sm text-slate-600">{p.notes}</p>
            )}
          </button>
        ))}
      </div>

      {!loading && plastics.length === 0 && !error && (
        <p className="mt-6 text-sm text-slate-500">
          No plastics found. Have you run the seed SQL (supabase/seed.sql)?
        </p>
      )}
    </div>
  );
}
