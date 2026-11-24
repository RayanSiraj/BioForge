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

// --- Catalytic residues (for mutation warnings) -----------------------------
// The nucleophilic serine sits in the conserved G-x-S-x-G "nucleophile elbow",
// so it can be located unambiguously from the stored sequence. Mutating it
// almost always abolishes catalysis. The full Ser–Asp–His triad is only
// asserted where verified (PETase). Positions index the STORED reference
// sequence (what the app folds/scores), 1-indexed.

export interface CatalyticSite {
  /** Catalytic nucleophile serine (G-x-S-x-G elbow). */
  nucleophileSer: number;
  /** Full Ser–Asp–His triad, where verified. */
  triad?: { ser: number; asp: number; his: number };
  note: string;
}

const CATALYTIC: Record<string, CatalyticSite> = {
  // Ideonella sakaiensis PETase — verified triad (mature 264-aa numbering).
  A0A0K8P6T7: {
    nucleophileSer: 134,
    triad: { ser: 134, asp: 180, his: 211 },
    note: "Ser134 · Asp180 · His211 — catalytic triad (G-W-S-M-G nucleophile elbow)",
  },
  // Leaf-branch compost cutinase (LCC) — nucleophile verified from G-H-S-M-G.
  G9BY57: {
    nucleophileSer: 165,
    note: "Ser165 — catalytic nucleophile (G-H-S-M-G elbow)",
  },
  // Thermobifida fusca cutinase — nucleophile verified from G-H-S-M-G.
  Q47RJ6: {
    nucleophileSer: 170,
    note: "Ser170 — catalytic nucleophile (G-H-S-M-G elbow)",
  },
};

export function catalyticSiteFor(
  uniprotId: string | null | undefined,
): CatalyticSite | null {
  return uniprotId ? (CATALYTIC[uniprotId] ?? null) : null;
}

export type ResidueRole = "catalytic" | "active-site" | "other";

/** Classify a 1-indexed position relative to a family's catalytic residues. */
export function classifyResidue(
  uniprotId: string | null | undefined,
  position: number,
): ResidueRole {
  const site = catalyticSiteFor(uniprotId);
  if (!site) return "other";
  const centers = site.triad
    ? [site.triad.ser, site.triad.asp, site.triad.his]
    : [site.nucleophileSer];
  if (centers.includes(position)) return "catalytic";
  if (centers.some((c) => Math.abs(c - position) <= 2)) return "active-site";
  return "other";
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
