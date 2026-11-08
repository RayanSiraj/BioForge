import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { generateVariants } from "@/lib/variants";
import { EsmUnavailableError } from "@/lib/esm2";
import { scoreVariantsLogged } from "@/lib/mutationRuns";

// POST /api/variants/generate
// Body: { enzyme_family_id: string, count?: number, mutationsPerVariant?: number }
//
// Takes the family's reference sequence, generates N mutated variants, scores
// each via the ESM-2 module, ranks them (1 = best in this batch), stores them,
// and returns the stored rows plus scoring metadata.
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    enzyme_family_id?: string;
    count?: number;
    mutationsPerVariant?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { enzyme_family_id, count = 10, mutationsPerVariant } = body;
  if (!enzyme_family_id) {
    return NextResponse.json(
      { error: "Missing required field: enzyme_family_id" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: family, error: famErr } = await supabase
    .from("enzyme_families")
    .select("id, reference_sequence")
    .eq("id", enzyme_family_id)
    .maybeSingle();

  if (famErr) {
    return NextResponse.json({ error: famErr.message }, { status: 500 });
  }
  if (!family) {
    return NextResponse.json(
      { error: "Enzyme family not found" },
      { status: 404 },
    );
  }

  // 1. Generate candidate sequences.
  const sequences = generateVariants(family.reference_sequence, {
    count,
    mutationsPerVariant,
  });
  if (sequences.length === 0) {
    return NextResponse.json(
      { error: "Could not generate variants from this reference sequence" },
      { status: 422 },
    );
  }

  // 2. Score via the isolated ESM-2 module (real masked-marginal, triage tier).
  //    No mock: if scoring is unavailable we fail loudly rather than fabricate.
  let scoring;
  try {
    scoring = await scoreVariantsLogged(
      supabase,
      null, // anonymous session (open app) — mutation_runs.user_id nullable
      family.reference_sequence,
      sequences,
      { tier: "triage" },
    );
  } catch (err) {
    const unavailable = err instanceof EsmUnavailableError;
    return NextResponse.json(
      {
        error: unavailable
          ? "ESM-2 scoring is unavailable — check HF_API_TOKEN and its inference permission."
          : err instanceof Error
            ? err.message
            : "Scoring failed",
        scoringUnavailable: unavailable,
      },
      { status: unavailable ? 503 : 502 },
    );
  }

  // 3. Rank: highest masked-marginal score = rank 1.
  const ranked = [...scoring.scores].sort((a, b) => b.score - a.score);
  const rows = ranked.map((s, i) => ({
    enzyme_family_id: family.id,
    sequence: s.sequence,
    esm2_score: s.score,
    rank: i + 1,
  }));

  // 4. Store.
  const { data: inserted, error: insErr } = await supabase
    .from("variants")
    .insert(rows)
    .select("*");

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    variants: inserted ?? [],
    scoring: {
      model: scoring.model,
      tier: scoring.tier,
      method: scoring.method,
    },
  });
}
