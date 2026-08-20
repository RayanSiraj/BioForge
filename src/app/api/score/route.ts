import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { EsmUnavailableError, type EsmTier } from "@/lib/esm2";
import { scoreOneVariantLogged } from "@/lib/mutationRuns";

export const maxDuration = 60;

// POST /api/score  { familyId, sequence, tier? }
// Scores an arbitrary sequence against a family's parent with ESM-2
// masked-marginals. Used for live re-scoring in the residue editor and the
// precise (650M) pass. No mock — failure returns an explicit error.
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    familyId?: string;
    sequence?: string;
    tier?: EsmTier;
    sweepId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { familyId, sequence, tier = "triage", sweepId } = body;
  if (!familyId || !sequence) {
    return NextResponse.json(
      { error: "familyId and sequence are required" },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { data: family, error } = await supabase
    .from("enzyme_families")
    .select("reference_sequence")
    .eq("id", familyId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!family)
    return NextResponse.json({ error: "Family not found" }, { status: 404 });

  try {
    const { score, runId } = await scoreOneVariantLogged(
      supabase,
      user.id,
      family.reference_sequence,
      sequence,
      { tier, sweepId },
    );
    return NextResponse.json({ ...score, tier, runId });
  } catch (err) {
    const unavailable = err instanceof EsmUnavailableError;
    return NextResponse.json(
      {
        error: unavailable
          ? "ESM-2 scoring is unavailable — check HF_API_TOKEN."
          : err instanceof Error
            ? err.message
            : "Scoring failed",
        scoringUnavailable: unavailable,
      },
      { status: unavailable ? 503 : 502 },
    );
  }
}
