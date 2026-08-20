"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface MutationSpec {
  position: number;
  wt: string;
  mut: string;
}
interface Run {
  id: string;
  created_at: string;
  input_sequence: string;
  mutation_spec: MutationSpec[];
  model_name: string;
  model_version: string | null;
  predicted_score: number | null;
  score_type: string;
  structural_confidence: number | null;
  status: "pending" | "completed" | "failed" | string;
}

type SortCol = "created_at" | "predicted_score" | "model_name" | "status";
type Dir = "asc" | "desc";

const PAGE_SIZES = [25, 50, 100];

function mutationLabel(spec: MutationSpec[]): string {
  if (!Array.isArray(spec) || spec.length === 0) return "—";
  return spec.map((m) => `${m.wt}${m.position}${m.mut}`).join(", ");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-signal-500/10 text-signal-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter / sort / pagination state.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<SortCol>("created_at");
  const [dir, setDir] = useState<Dir>("desc");
  const [model, setModel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryString = useCallback(
    (overrides: Record<string, string | number> = {}) => {
      const p = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
        dir,
        ...(model ? { model } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...Object.fromEntries(
          Object.entries(overrides).map(([k, v]) => [k, String(v)]),
        ),
      });
      return p.toString();
    },
    [page, pageSize, sort, dir, model, from, to],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/runs?${queryString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          return;
        }
        setRuns(d.runs ?? []);
        setTotal(d.total ?? 0);
        setModels(d.models ?? []);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(col: SortCol) {
    if (sort === col) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setDir("desc");
    }
    setPage(1);
  }

  function clearFilters() {
    setModel("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  function exportCsv() {
    const headers = [
      "created_at",
      "status",
      "model_name",
      "model_version",
      "score_type",
      "predicted_score",
      "structural_confidence",
      "mutations",
      "input_sequence",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of runs) {
      lines.push(
        [
          r.created_at,
          r.status,
          r.model_name,
          r.model_version ?? "",
          r.score_type,
          r.predicted_score ?? "",
          r.structural_confidence ?? "",
          mutationLabel(r.mutation_spec),
          r.input_sequence,
        ]
          .map(esc)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mutation-runs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0 runs";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}–${end} of ${total}`;
  }, [page, pageSize, total]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Run history</h1>
      <p className="mt-1 text-sm text-slate-500">
        Every ESM mutation-prediction call is logged here — input sequence,
        mutation, model, score, and status.
      </p>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">Model</span>
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setPage(1);
            }}
            className="w-56 rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All models</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">Per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={clearFilters}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            onClick={exportCsv}
            disabled={runs.length === 0}
            className="rounded bg-signal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-signal-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <SortableTh
                label="Timestamp"
                col="created_at"
                sort={sort}
                dir={dir}
                onSort={toggleSort}
              />
              <th className="px-3 py-2">Input sequence</th>
              <th className="px-3 py-2">Mutation</th>
              <SortableTh
                label="Model"
                col="model_name"
                sort={sort}
                dir={dir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Score"
                col="predicted_score"
                sort={sort}
                dir={dir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Status"
                col="status"
                sort={sort}
                dir={dir}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No runs match these filters.
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      title={r.input_sequence}
                      className="cursor-help font-mono text-xs text-slate-500"
                    >
                      {r.input_sequence.slice(0, 20)}
                      {r.input_sequence.length > 20 ? "…" : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">
                    {mutationLabel(r.mutation_spec)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {r.model_name}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.predicted_score != null
                      ? r.predicted_score.toFixed(4)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>{rangeLabel}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="rounded border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  col,
  sort,
  dir,
  onSort,
}: {
  label: string;
  col: SortCol;
  sort: SortCol;
  dir: Dir;
  onSort: (c: SortCol) => void;
}) {
  const active = sort === col;
  return (
    <th className="px-3 py-2">
      <button
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 font-medium ${
          active ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        {label}
        <span className="text-[10px] text-slate-400">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
