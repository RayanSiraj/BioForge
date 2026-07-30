// Simple variant generation for the MVP. Intentionally minimal: apply a small
// number of random point mutations to the reference sequence. Not meant to be
// biologically clever — just produce N distinct candidates to score/rank.

// The 20 standard proteinogenic amino acids.
const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY".split("");

export interface GenerateOptions {
  /** Number of variants to produce. */
  count: number;
  /** Point mutations to apply per variant (default 1–3, scaled to length). */
  mutationsPerVariant?: number;
}

/**
 * Generate `count` mutated variants of a reference sequence via random point
 * substitutions. Returns unique sequences (best-effort; may return fewer than
 * `count` if the reference is extremely short).
 */
export function generateVariants(
  reference: string,
  options: GenerateOptions,
): string[] {
  const clean = reference.replace(/[^A-Za-z]/g, "").toUpperCase();
  const count = Math.max(1, Math.min(options.count, 200));
  const mutations = Math.max(
    1,
    options.mutationsPerVariant ?? Math.min(3, Math.ceil(clean.length / 100)),
  );

  const seen = new Set<string>();
  const out: string[] = [];
  let attempts = 0;
  const maxAttempts = count * 20;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const mutated = applyPointMutations(clean, mutations);
    if (mutated !== clean && !seen.has(mutated)) {
      seen.add(mutated);
      out.push(mutated);
    }
  }

  return out;
}

function applyPointMutations(sequence: string, mutations: number): string {
  const chars = sequence.split("");
  if (chars.length === 0) return sequence;

  for (let m = 0; m < mutations; m++) {
    const pos = Math.floor(Math.random() * chars.length);
    const current = chars[pos];
    let replacement = current;
    // pick a different amino acid
    while (replacement === current) {
      replacement = AMINO_ACIDS[Math.floor(Math.random() * AMINO_ACIDS.length)];
    }
    chars[pos] = replacement;
  }

  return chars.join("");
}
