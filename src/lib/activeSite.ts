// ---------------------------------------------------------------------------
// Active-site definition + structural-confidence thresholds (prompt #3).
//
// The active-site RMSD compares the mutant's catalytic region against the
// wild-type reference. It is defined for the PETase reference only; for any
// other enzyme we return null (the metric isn't meaningful without a known
// active site).
//
// IMPORTANT — numbering: the stored PETase reference (UniProt A0A0K8P6T7) is the
// 264-aa MATURE form (signal peptide removed), so the catalytic triad sits at
// Ser134 / Asp180 / His211 in that sequence — verified from the sequence itself
// (the GWSMG nucleophile motif + the single triad Asp/His in range). These are
// the mature-form equivalents of the literature full-length Ser160/Asp206/His237
// (offset −26). ESMFold numbers residues 1..N of this same sequence, so these
// positions index both the mutant and wild-type folds directly.
// ---------------------------------------------------------------------------

export const PETASE_UNIPROT = "A0A0K8P6T7";

/** Catalytic triad (Ser–Asp–His) in the stored 264-aa mature PETase sequence. */
export const PETASE_TRIAD = [134, 180, 211] as const;

/** Residues included on each side of every triad position. */
const TRIAD_WINDOW = 2;

/** Alpha-carbon residues that make up the PETase active-site comparison set. */
export function petaseActiveSiteResidues(): number[] {
  const set = new Set<number>();
  for (const center of PETASE_TRIAD) {
    for (let d = -TRIAD_WINDOW; d <= TRIAD_WINDOW; d++) set.add(center + d);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Active-site residue list for a family's reference, or null if no active site
 * is defined for it (RMSD is only computed for the PETase reference).
 */
export function activeSiteResiduesFor(
  uniprotId: string | null | undefined,
): number[] | null {
  return uniprotId === PETASE_UNIPROT ? petaseActiveSiteResidues() : null;
}

// --- Confidence thresholds --------------------------------------------------

/** pLDDT below this is flagged "low structural confidence". */
export const PLDDT_MIN = 70;

/** Active-site RMSD (Å) above this is flagged. Configurable via env. */
export function rmsdMax(): number {
  const v = parseFloat(process.env.ACTIVE_SITE_RMSD_MAX ?? "");
  return Number.isFinite(v) && v > 0 ? v : 2.0;
}

/** True if either structural metric falls outside its sane range. */
export function isLowConfidence(
  meanPlddt: number | null,
  rmsd: number | null,
): boolean {
  if (meanPlddt != null && meanPlddt < PLDDT_MIN) return true;
  if (rmsd != null && rmsd > rmsdMax()) return true;
  return false;
}
