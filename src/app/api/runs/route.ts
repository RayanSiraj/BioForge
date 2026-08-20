import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

// GET /api/runs — paginated, sortable, filterable list of mutation_runs.
// Query params:
//   page, pageSize            — pagination (1-based)
//   sort, dir                 — sort column + direction
//   model                     — filter by model_name (exact)
//   from, to                  — created_at date range (YYYY-MM-DD, inclusive)
const SORTABLE = new Set([
  "created_at",
  "predicted_score",
  "model_name",
  "status",
]);

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    500,
    Math.max(1, parseInt(sp.get("pageSize") ?? "25", 10) || 25),
  );
  const sort = SORTABLE.has(sp.get("sort") ?? "")
    ? (sp.get("sort") as string)
    : "created_at";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const model = sp.get("model")?.trim();
  const from = sp.get("from")?.trim();
  const to = sp.get("to")?.trim();

  const supabase = createClient();

  let q = supabase.from("mutation_runs").select("*", { count: "exact" });
  if (model) q = q.eq("model_name", model);
  // Date-only bounds → widen to whole-day timestamps so the range is inclusive.
  if (from) q = q.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) q = q.lte("created_at", `${to}T23:59:59.999Z`);

  q = q
    .order(sort, { ascending: dir === "asc", nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Distinct model_name values for the filter dropdown (capped).
  const { data: modelRows } = await supabase
    .from("mutation_runs")
    .select("model_name")
    .limit(1000);
  const models = [
    ...new Set((modelRows ?? []).map((r) => r.model_name as string)),
  ].sort();

  return NextResponse.json({
    runs: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    models,
  });
}
