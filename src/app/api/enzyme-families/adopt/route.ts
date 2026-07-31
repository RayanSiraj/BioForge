import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchEnzyme } from "@/lib/uniprot";

// POST /api/enzyme-families/adopt
// Body: { plastic: string, accession: string }
//
// Turns a picked UniProtKB enzyme into a real enzyme_families row so the rest
// of the pipeline (variant generation, ESM-2 scoring, AlphaFold structure) runs
// unchanged. The plastic and family are get-or-created; the reference sequence
// is fetched by accession server-side (never trusted from the client). Writes
// use the admin client because plastics/enzyme_families are read-only under RLS.
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { plastic?: string; accession?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plastic = body.plastic?.trim();
  const accession = body.accession?.trim();
  if (!plastic || !accession) {
    return NextResponse.json(
      { error: "Missing required fields: plastic, accession" },
      { status: 400 },
    );
  }

  let enzyme;
  try {
    enzyme = await fetchEnzyme(accession);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not fetch enzyme" },
      { status: 502 },
    );
  }

  const admin = createAdminClient();

  // get-or-create the (free-text) plastic target
  const { data: p, error: pErr } = await admin
    .from("plastics")
    .upsert({ name: plastic }, { onConflict: "name" })
    .select("id")
    .maybeSingle();
  if (pErr || !p) {
    return NextResponse.json(
      { error: pErr?.message ?? "Could not save plastic target" },
      { status: 500 },
    );
  }

  // get-or-create the enzyme family from the UniProt entry
  const { data: fam, error: fErr } = await admin
    .from("enzyme_families")
    .upsert(
      {
        plastic_id: p.id,
        name: enzyme.name,
        reference_sequence: enzyme.sequence,
        rationale:
          `Candidate retrieved from UniProtKB for "${plastic}"` +
          `${enzyme.organism ? ` · ${enzyme.organism}` : ""}. ` +
          `Unvetted for plastic degradation — computational triage only.`,
        source_citation: `UniProtKB:${enzyme.accession}`,
        uniprot_id: enzyme.accession,
      },
      { onConflict: "plastic_id,name" },
    )
    .select("id, name")
    .maybeSingle();
  if (fErr || !fam) {
    return NextResponse.json(
      { error: fErr?.message ?? "Could not save enzyme family" },
      { status: 500 },
    );
  }

  return NextResponse.json({ family: fam });
}
