// ---------------------------------------------------------------------------
// ESM-2 variant scoring — ISOLATED integration boundary.
//
// Method: masked-marginal scoring (Meier et al., 2021). For each mutated
// position we mask that residue in the parent sequence, ask ESM-2 (fill-mask)
// for the probability of the wild-type and mutant residues, and take the
// log-likelihood ratio  ln P(mut) − ln P(wt).  A variant's score is the sum of
// these per-mutation deltas: >0 means ESM-2 favours the substitution over
// wild-type, <0 means it disfavours it. This is a real, published proxy for how
// tolerated a mutation is — not an embedding heuristic and NOT a mock.
//
// Two model tiers (see ESM2_MODELS): a small model for fast triage of many
// variants, and the 650M model for a precise pass on a chosen few.
//
// Served via HuggingFace's hf-inference provider. No token / API failure throws
// EsmUnavailableError — callers surface an explicit "scoring unavailable" state
// rather than any fabricated number.
// ---------------------------------------------------------------------------

import { env } from "@/lib/env";
import { diffMutations, type Mutation } from "@/lib/structures";

const HF_ROUTER = "https://router.huggingface.co/hf-inference/models";

export const ESM2_MODELS = {
  triage: env.esm2Model(), // small, fast (default facebook/esm2_t6_8M_UR50D)
  precise: "facebook/esm2_t33_650M_UR50D",
} as const;

export type EsmTier = keyof typeof ESM2_MODELS;

export class EsmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EsmUnavailableError";
  }
}

export interface MutationScore extends Mutation {
  wtProb: number;
  mutProb: number;
  delta: number; // ln(mutProb) − ln(wtProb)
}

export interface VariantScore {
  sequence: string;
  score: number; // sum of per-mutation deltas
  mutations: MutationScore[];
}

export interface ScoreResult {
  scores: VariantScore[];
  model: string;
  tier: EsmTier;
  method: "esm2-masked-marginal";
}

interface FillMaskItem {
  token_str: string;
  score: number;
}

// --- Public API ------------------------------------------------------------

/**
 * Score variants against a parent sequence by masked-marginal log-likelihood.
 * Batches by distinct mutated position (one API call per position, not per
 * variant) since every variant is a point-mutant of the same parent.
 */
export async function scoreVariants(
  reference: string,
  variants: string[],
  opts: { tier?: EsmTier } = {},
): Promise<ScoreResult> {
  const token = env.hfApiToken();
  if (!token) {
    throw new EsmUnavailableError(
      "HF_API_TOKEN is not set — ESM-2 scoring is unavailable.",
    );
  }
  const tier: EsmTier = opts.tier ?? "triage";
  const model = ESM2_MODELS[tier];
  const parent = reference.replace(/[^A-Za-z]/g, "").toUpperCase();

  // 1. Diff every variant, collect the residues needed at each position.
  const perVariant = variants.map((v) => ({
    sequence: v,
    mutations: diffMutations(parent, v),
  }));

  const needed = new Map<number, Set<string>>(); // position -> residues
  for (const { mutations } of perVariant) {
    for (const m of mutations) {
      if (!needed.has(m.position)) needed.set(m.position, new Set());
      const set = needed.get(m.position)!;
      set.add(m.from); // wild-type
      set.add(m.to); // mutant
    }
  }

  // 2. One masked call per distinct position (bounded concurrency).
  const positions = [...needed.keys()];
  const probByPosition = new Map<number, Map<string, number>>();
  await mapWithConcurrency(positions, 4, async (pos) => {
    const targets = [...needed.get(pos)!];
    const probs = await maskedProbabilities(parent, pos, targets, model, token);
    probByPosition.set(pos, probs);
  });

  // 3. Assemble per-variant scores.
  const scores: VariantScore[] = perVariant.map(({ sequence, mutations }) => {
    const scored: MutationScore[] = mutations.map((m) => {
      const probs = probByPosition.get(m.position)!;
      const wtProb = probs.get(m.from) ?? 1e-6;
      const mutProb = probs.get(m.to) ?? 1e-6;
      return {
        ...m,
        wtProb,
        mutProb,
        delta: Math.log(mutProb) - Math.log(wtProb),
      };
    });
    const score = scored.reduce((sum, m) => sum + m.delta, 0);
    return { sequence, score, mutations: scored };
  });

  return { scores, model, tier, method: "esm2-masked-marginal" };
}

/** Score a single variant (used by the live re-scoring / editor path). */
export async function scoreOneVariant(
  reference: string,
  variant: string,
  opts: { tier?: EsmTier } = {},
): Promise<VariantScore> {
  const { scores } = await scoreVariants(reference, [variant], opts);
  return scores[0];
}

// --- HuggingFace fill-mask -------------------------------------------------

// Mask a single 1-indexed position and return P(residue) for each requested
// target residue at that position.
async function maskedProbabilities(
  parent: string,
  position: number,
  targets: string[],
  model: string,
  token: string,
): Promise<Map<string, number>> {
  const i = position - 1;
  const masked = parent.slice(0, i) + "<mask>" + parent.slice(i + 1);

  const res = await fetch(`${HF_ROUTER}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: masked,
      parameters: { targets },
      options: { wait_for_model: true },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new EsmUnavailableError(
      `ESM-2 fill-mask failed (HTTP ${res.status}): ${text.slice(0, 160)}`,
    );
  }

  const data = (await res.json()) as FillMaskItem[];
  const out = new Map<string, number>();
  for (const item of data) {
    if (item.token_str) out.set(item.token_str.trim().toUpperCase(), item.score);
  }
  return out;
}

// --- util ------------------------------------------------------------------

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const current = idx++;
      await fn(items[current]);
    }
  });
  await Promise.all(workers);
}
