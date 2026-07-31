// ---------------------------------------------------------------------------
// Structure retrieval — real external calls, server-side only.
//
// Parent / reference structures: AlphaFold DB (precomputed, by UniProt ID).
// Novel variant structures: ESMFold via the ESM Atlas API (on-demand folding,
// no MSA). Both return PDB text; ESMFold encodes per-residue pLDDT confidence
// in the B-factor column, which we parse out.
//
// No fallbacks that fabricate structures: if a call fails, we throw and the
// caller surfaces an honest error state.
// ---------------------------------------------------------------------------

const ALPHAFOLD_API = "https://alphafold.ebi.ac.uk/api/prediction";
const ESMFOLD_API = "https://api.esmatlas.com/foldSequence/v1/pdb/";

// EBI's CDN 403s requests without a browser-like User-Agent, so set one on
// outbound structure calls.
const UA =
  "Mozilla/5.0 (compatible; BioForge/1.0; +https://bioforge.local) structure-viewer";

export interface StructureResult {
  pdb: string;
  source: "alphafold" | "esmfold";
  /** Mean pLDDT across residues, 0–100. */
  meanPlddt: number | null;
  meta: Record<string, unknown>;
}

// --- AlphaFold parent structure --------------------------------------------

export async function fetchAlphaFold(
  uniprotId: string,
): Promise<StructureResult> {
  const metaRes = await fetch(`${ALPHAFOLD_API}/${uniprotId}`, {
    headers: { accept: "application/json", "User-Agent": UA },
    // AlphaFold entries are static; cache for a day.
    next: { revalidate: 86400 },
  });
  if (!metaRes.ok) {
    throw new Error(
      `AlphaFold has no entry for ${uniprotId} (HTTP ${metaRes.status}).`,
    );
  }
  const entries = (await metaRes.json()) as Array<{
    pdbUrl?: string;
    cifUrl?: string;
    entryId?: string;
    organismScientificName?: string;
  }>;
  const entry = entries?.[0];
  if (!entry?.pdbUrl) {
    throw new Error(`AlphaFold entry for ${uniprotId} has no PDB file.`);
  }

  const pdbRes = await fetch(entry.pdbUrl, {
    headers: { "User-Agent": UA },
    next: { revalidate: 86400 },
  });
  if (!pdbRes.ok) {
    throw new Error(`Could not download AlphaFold PDB (HTTP ${pdbRes.status}).`);
  }
  const pdb = await pdbRes.text();

  return {
    pdb,
    source: "alphafold",
    meanPlddt: meanPlddtFromPdb(pdb),
    meta: {
      uniprotId,
      entryId: entry.entryId ?? null,
      organism: entry.organismScientificName ?? null,
    },
  };
}

// --- ESMFold variant structure ---------------------------------------------

export async function foldWithEsmfold(
  sequence: string,
): Promise<StructureResult> {
  const clean = sequence.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (clean.length < 10) {
    throw new Error("Sequence too short to fold.");
  }
  // ESM Atlas caps single-sequence folding around 400 residues.
  if (clean.length > 400) {
    throw new Error(
      `Sequence is ${clean.length} residues; ESMFold (ESM Atlas) supports up to 400.`,
    );
  }

  const res = await fetch(ESMFOLD_API, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: clean,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ESMFold failed (HTTP ${res.status}): ${text.slice(0, 160)}`);
  }
  const raw = await res.text();
  if (!raw.includes("ATOM")) {
    throw new Error("ESMFold returned an unexpected (non-PDB) response.");
  }
  // ESM Atlas encodes pLDDT on a 0–1 scale in the B-factor column, whereas
  // AlphaFold uses 0–100. Normalise to 0–100 so colouring and the mean match.
  const pdb = rescalePlddtTo100(raw);

  return {
    pdb,
    source: "esmfold",
    meanPlddt: meanPlddtFromPdb(pdb),
    meta: { residues: clean.length },
  };
}

// If the per-atom B-factors look like a 0–1 fraction, rescale every atom's
// B-factor to the 0–100 pLDDT convention. No-op when already 0–100.
function rescalePlddtTo100(pdb: string): string {
  let maxB = 0;
  for (const line of pdb.split("\n")) {
    if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) continue;
    const b = parseFloat(line.slice(60, 66));
    if (!Number.isNaN(b) && b > maxB) maxB = b;
  }
  if (maxB > 1.5) return pdb; // already on 0–100

  return pdb
    .split("\n")
    .map((line) => {
      if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) return line;
      const b = parseFloat(line.slice(60, 66));
      if (Number.isNaN(b)) return line;
      const scaled = Math.min(100, b * 100).toFixed(2).padStart(6);
      return line.slice(0, 60) + scaled + line.slice(66);
    })
    .join("\n");
}

// --- pLDDT parsing ----------------------------------------------------------
// In both AlphaFold and ESMFold PDB output, the per-atom B-factor column holds
// the pLDDT confidence. Average over CA atoms for a per-residue mean.

function meanPlddtFromPdb(pdb: string): number | null {
  let sum = 0;
  let n = 0;
  for (const line of pdb.split("\n")) {
    if (!line.startsWith("ATOM")) continue;
    // PDB fixed columns: atom name 13-16, B-factor 61-66 (1-indexed).
    const atomName = line.slice(12, 16).trim();
    if (atomName !== "CA") continue;
    const b = parseFloat(line.slice(60, 66));
    if (!Number.isNaN(b)) {
      sum += b;
      n += 1;
    }
  }
  return n === 0 ? null : Math.round((sum / n) * 10) / 10;
}

// --- Mutation diff ----------------------------------------------------------
// 1-indexed residue positions where the variant differs from the parent.

export interface Mutation {
  position: number; // 1-indexed
  from: string;
  to: string;
}

export function diffMutations(
  parent: string,
  variant: string,
): Mutation[] {
  const p = parent.replace(/[^A-Za-z]/g, "").toUpperCase();
  const v = variant.replace(/[^A-Za-z]/g, "").toUpperCase();
  const len = Math.min(p.length, v.length);
  const out: Mutation[] = [];
  for (let i = 0; i < len; i++) {
    if (p[i] !== v[i]) {
      out.push({ position: i + 1, from: p[i], to: v[i] });
    }
  }
  return out;
}
