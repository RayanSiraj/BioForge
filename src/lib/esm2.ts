// ---------------------------------------------------------------------------
// ESM-2 scoring module — ISOLATED integration boundary.
//
// The rest of the app only depends on `scoreVariants()` and the `ScoredSequence`
// shape. To change the scoring approach (e.g. true pseudo-perplexity, a local
// model, a different endpoint), edit ONLY this file.
//
// Current MVP approach: fetch mean-pooled ESM-2 embeddings from the HuggingFace
// Inference API for the reference sequence and each variant, then use cosine
// similarity to the reference embedding as a proxy for "how structurally/
// functionally conserved" the variant is. Higher = closer to the reference
// fold => a rough proxy for retained stability.
//
// If HF_API_TOKEN is not set, falls back to a DETERMINISTIC LOCAL MOCK so the
// full flow works end-to-end without external calls. Mock scores are clearly
// not real ESM-2 output — see `usedMock` in the result.
// ---------------------------------------------------------------------------

import { env } from "@/lib/env";

const HF_BASE = "https://api-inference.huggingface.co/models";

export interface ScoredSequence {
  sequence: string;
  /** Proxy stability score in [0, 1]; higher is better. */
  score: number;
}

export interface ScoreResult {
  scores: ScoredSequence[];
  /** True when the deterministic mock was used (no HF token / HF error). */
  usedMock: boolean;
  model: string;
  note: string;
}

/**
 * Score each variant against a reference sequence.
 * @param referenceSequence canonical family sequence
 * @param variants list of variant amino-acid sequences
 */
export async function scoreVariants(
  referenceSequence: string,
  variants: string[],
): Promise<ScoreResult> {
  const model = env.esm2Model();
  const token = env.hfApiToken();

  if (!token) {
    return {
      scores: variants.map((sequence) => ({
        sequence,
        score: mockScore(referenceSequence, sequence),
      })),
      usedMock: true,
      model,
      note: "HF_API_TOKEN not set — used deterministic local mock, not real ESM-2.",
    };
  }

  try {
    const refEmbedding = await fetchEmbedding(referenceSequence, model, token);
    const scores: ScoredSequence[] = [];
    for (const sequence of variants) {
      const emb = await fetchEmbedding(sequence, model, token);
      scores.push({ sequence, score: cosineSimilarity(refEmbedding, emb) });
    }
    return {
      scores,
      usedMock: false,
      model,
      note: "Cosine similarity of mean-pooled ESM-2 embeddings vs. reference.",
    };
  } catch (err) {
    // Never fail the whole request because the external API hiccuped — fall
    // back to the mock and surface that we did so.
    return {
      scores: variants.map((sequence) => ({
        sequence,
        score: mockScore(referenceSequence, sequence),
      })),
      usedMock: true,
      model,
      note: `HF inference failed (${
        err instanceof Error ? err.message : "unknown error"
      }) — fell back to deterministic mock.`,
    };
  }
}

// --- HuggingFace call ------------------------------------------------------

async function fetchEmbedding(
  sequence: string,
  model: string,
  token: string,
): Promise<number[]> {
  const res = await fetch(`${HF_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: sequence,
      // wait for the model to load rather than erroring on cold start
      options: { wait_for_model: true },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HF ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as unknown;
  return meanPool(data);
}

// The feature-extraction pipeline for ESM returns either a per-token matrix
// (number[][]) or, occasionally, an already-pooled vector (number[]). Handle
// both and mean-pool token embeddings down to a single vector.
function meanPool(data: unknown): number[] {
  if (Array.isArray(data) && data.length > 0) {
    if (typeof data[0] === "number") {
      return data as number[];
    }
    if (Array.isArray(data[0])) {
      // Some endpoints wrap in an extra batch dimension: number[][][].
      const matrix = (
        Array.isArray((data[0] as unknown[])[0]) ? data[0] : data
      ) as number[][];
      const dim = matrix[0].length;
      const pooled = new Array<number>(dim).fill(0);
      for (const row of matrix) {
        for (let i = 0; i < dim; i++) pooled[i] += row[i];
      }
      for (let i = 0; i < dim; i++) pooled[i] /= matrix.length;
      return pooled;
    }
  }
  throw new Error("Unexpected embedding shape from HF inference API");
}

// --- Math ------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  const cos = dot / (Math.sqrt(na) * Math.sqrt(nb));
  // map [-1, 1] -> [0, 1] and clamp
  return Math.max(0, Math.min(1, (cos + 1) / 2));
}

// --- Deterministic mock ----------------------------------------------------
// Rewards similarity to the reference (fewer mutations => higher score) with a
// small deterministic jitter so ranks are stable across runs but not all tied.
function mockScore(reference: string, variant: string): number {
  const len = Math.max(reference.length, variant.length);
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (reference[i] === variant[i]) matches++;
  }
  const identity = len === 0 ? 1 : matches / len;
  const jitter = (hashString(variant) % 1000) / 100000; // < 0.01
  return Math.max(0, Math.min(1, identity - jitter));
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
