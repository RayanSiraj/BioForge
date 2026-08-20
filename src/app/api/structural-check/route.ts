import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { foldWithEsmfold } from "@/lib/structures";
import { perResiduePlddt } from "@/lib/pdb";
import { caCoordsByResidue, superposeRmsd, type Vec3 } from "@/lib/rmsd";
import {
  activeSiteResiduesFor,
  isLowConfidence,
  PLDDT_MIN,
  rmsdMax,
} from "@/lib/activeSite";

// POST /api/structural-check  { familyId, sequence, runId?, mutantPdb? }
//
// The structural self-consistency step: fold the mutant with ESMFold (ESM
// Atlas), read its mean pLDDT, and — for the PETase reference — superpose its
// active-site Cα atoms on the wild-type fold and compute RMSD. Results are
// stored on the mutation_runs row (structural_confidence + active_site_rmsd)
// and returned for the UI. Slow by design (ESMFold); the caller runs this
// after the stability score is already shown.
export const maxDuration = 120;

// Wild-type folds are reused across a family's variants for this server's
// lifetime — they only depend on the reference sequence.
const wtFoldCache = new Map<string, string>();

const cleanSeq = (s: string) => s.replace(/[^A-Za-z]/g, "").toUpperCase();

function meanPlddtOf(pdb: string): number | null {
  const vals = [...perResiduePlddt(pdb).values()];
  if (vals.length === 0) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(mean * 10) / 10;
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    familyId?: string;
    sequence?: string;
    runId?: string;
    mutantPdb?: string;
    persistStructure?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { familyId, sequence, runId, mutantPdb, persistStructure } = body;
  if (!familyId || !sequence) {
    return NextResponse.json(
      { error: "familyId and sequence are required" },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { data: family, error } = await supabase
    .from("enzyme_families")
    .select("reference_sequence, uniprot_id, name")
    .eq("id", familyId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!family)
    return NextResponse.json({ error: "Family not found" }, { status: 404 });

  // 1. Mutant structure — reuse the caller's ESMFold if it passed one, else fold.
  let mPdb = mutantPdb;
  try {
    if (!mPdb || !mPdb.includes("ATOM")) {
      mPdb = (await foldWithEsmfold(sequence)).pdb;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "ESMFold failed",
        stage: "fold",
      },
      { status: 502 },
    );
  }
  const meanPlddt = meanPlddtOf(mPdb);

  // 2. Active-site RMSD vs wild-type (PETase reference only).
  const residues = activeSiteResiduesFor(family.uniprot_id);
  let activeSiteRmsd: number | null = null;
  let rmsdNote: string | null = null;

  if (residues) {
    try {
      const ref = cleanSeq(family.reference_sequence);
      let wtPdb = wtFoldCache.get(ref);
      if (!wtPdb) {
        wtPdb = (await foldWithEsmfold(ref)).pdb;
        wtFoldCache.set(ref, wtPdb);
      }
      const mCoords = caCoordsByResidue(mPdb);
      const wCoords = caCoordsByResidue(wtPdb);
      const A: Vec3[] = [];
      const B: Vec3[] = [];
      for (const r of residues) {
        const a = mCoords.get(r);
        const b = wCoords.get(r);
        if (a && b) {
          A.push(a);
          B.push(b);
        }
      }
      activeSiteRmsd = superposeRmsd(A, B);
      if (activeSiteRmsd == null) {
        rmsdNote = "Too few active-site residues resolved to superpose.";
      } else {
        activeSiteRmsd = Math.round(activeSiteRmsd * 1000) / 1000;
      }
    } catch (e) {
      rmsdNote = e instanceof Error ? e.message : "RMSD computation failed";
    }
  } else {
    rmsdNote = "Active-site RMSD is defined for the PETase reference only.";
  }

  const lowConfidence = isLowConfidence(meanPlddt, activeSiteRmsd);

  // 3. Persist onto the run row (best-effort — never fail the response on this).
  if (runId) {
    try {
      const patch: Record<string, unknown> = {
        structural_confidence: meanPlddt,
        active_site_rmsd: activeSiteRmsd,
      };
      // Keep the structure only for interactive runs (the viewer's context);
      // sweeps skip this to avoid storing hundreds of PDBs.
      if (persistStructure) patch.structure_pdb = mPdb;
      await supabase.from("mutation_runs").update(patch).eq("id", runId);
    } catch (e) {
      console.error("[structural-check] run update failed:", e);
    }
  }

  return NextResponse.json({
    meanPlddt,
    activeSiteRmsd,
    activeSiteApplicable: !!residues,
    activeSiteResidues: residues,
    rmsdNote,
    lowConfidence,
    thresholds: { plddtMin: PLDDT_MIN, rmsdMax: rmsdMax() },
  });
}
