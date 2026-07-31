// Client-safe PDB helpers (pure string parsing, no network/node deps).

// Map of 1-indexed residue number -> pLDDT (CA B-factor). Works on AlphaFold
// and (scale-normalised) ESMFold PDBs.
export function perResiduePlddt(pdb: string): Map<number, number> {
  const map = new Map<number, number>();
  for (const line of pdb.split("\n")) {
    if (!line.startsWith("ATOM")) continue;
    if (line.slice(12, 16).trim() !== "CA") continue;
    const resSeq = parseInt(line.slice(22, 26).trim(), 10);
    const b = parseFloat(line.slice(60, 66));
    if (!Number.isNaN(resSeq) && !Number.isNaN(b)) map.set(resSeq, b);
  }
  return map;
}
