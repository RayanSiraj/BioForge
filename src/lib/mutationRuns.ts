// ---------------------------------------------------------------------------
// Persistent run-logging around ESM mutation prediction.
//
// Wraps the pure scoring functions in `esm2.ts` so that every scored variant
// (one HF masked-marginal prediction) is recorded in `mutation_runs`: a pending
// row is inserted BEFORE the HF call and updated to completed/failed AFTER. This
// runs server-side (inside the API routes), so it can't be bypassed or dropped
// by a slow client.
//
// Logging is best-effort: a database hiccup here must never break a prediction,
// so all DB access is guarded — the scoring result (and any scoring error) is
// returned/thrown exactly as before. UX is unchanged.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import { diffMutations } from "@/lib/structures";
import {
  ESM2_MODELS,
  scoreVariants,
  type EsmTier,
  type ScoreResult,
  type VariantScore,
} from "@/lib/esm2";

// Metric produced by esm2.ts: summed masked-marginal log-likelihood ratio.
const SCORE_TYPE = "esm_pll";

function cleanSeq(s: string): string {
  return s.replace(/[^A-Za-z]/g, "").toUpperCase();
}

function specOf(parent: string, variant: string) {
  return diffMutations(parent, variant).map((m) => ({
    position: m.position,
    wt: m.from,
    mut: m.to,
  }));
}

/**
 * Score variants against a parent, logging each scored variant to
 * `mutation_runs`, and return the result together with the run id created for
 * each variant (null where a variant was identical to the parent, so nothing
 * was logged). Run ids let the caller attach later results (e.g. the structural
 * self-consistency metrics) to the right row.
 */
async function scoreAndLog(
  supabase: SupabaseClient,
  userId: string | null,
  reference: string,
  variants: string[],
  opts: { tier?: EsmTier; sweepId?: string | null } = {},
): Promise<{ result: ScoreResult; runIdByIndex: (string | null)[] }> {
  const tier: EsmTier = opts.tier ?? "triage";
  const model = ESM2_MODELS[tier];
  const parent = cleanSeq(reference);
  const runIdByIndex: (string | null)[] = new Array(variants.length).fill(null);

  // Only log variants that actually differ from the parent — an identical
  // sequence triggers no HF call, so there's no prediction to record.
  const specs = variants.map((v) => specOf(parent, v));
  const logIdx = specs
    .map((s, i) => (s.length > 0 ? i : -1))
    .filter((i) => i >= 0);

  // 1. Insert a pending row per logged variant BEFORE the HF call.
  let ids: (string | null)[] = [];
  if (logIdx.length > 0) {
    try {
      const rows = logIdx.map((i) => ({
        user_id: userId,
        input_sequence: parent,
        mutation_spec: specs[i],
        model_name: model,
        score_type: SCORE_TYPE,
        status: "pending" as const,
        sweep_id: opts.sweepId ?? null,
      }));
      const { data, error } = await supabase
        .from("mutation_runs")
        .insert(rows)
        .select("id");
      if (error) throw error;
      ids = (data ?? []).map((r) => r.id as string);
      logIdx.forEach((vi, k) => (runIdByIndex[vi] = ids[k] ?? null));
    } catch (e) {
      console.error("[mutation_runs] pending insert failed:", e);
      ids = [];
    }
  }

  // 2. Run the actual scoring.
  let result: ScoreResult;
  try {
    result = await scoreVariants(reference, variants, opts);
  } catch (err) {
    // Mark every pending row failed, then rethrow unchanged.
    await markFailed(supabase, ids, err);
    throw err;
  }

  // 3. Update each pending row with its score (best-effort).
  await Promise.all(
    logIdx.map((variantIndex, k) => {
      const id = ids[k];
      if (!id) return Promise.resolve();
      const score = result.scores[variantIndex];
      return updateOne(supabase, id, {
        status: "completed",
        predicted_score: score.score,
        raw_response: {
          model: result.model,
          tier: result.tier,
          method: result.method,
          mutations: score.mutations,
        },
      });
    }),
  );

  return { result, runIdByIndex };
}

/**
 * Score variants with logging. Behaviour and return value are identical to
 * `scoreVariants` — logging is a side-channel.
 */
export async function scoreVariantsLogged(
  supabase: SupabaseClient,
  userId: string | null,
  reference: string,
  variants: string[],
  opts: { tier?: EsmTier } = {},
): Promise<ScoreResult> {
  const { result } = await scoreAndLog(
    supabase,
    userId,
    reference,
    variants,
    opts,
  );
  return result;
}

/**
 * Single-variant scoring with logging. Returns the score plus the id of the
 * logged run (null if the variant matched the parent), so the caller can attach
 * the structural check to it.
 */
export async function scoreOneVariantLogged(
  supabase: SupabaseClient,
  userId: string | null,
  reference: string,
  variant: string,
  opts: { tier?: EsmTier; sweepId?: string | null } = {},
): Promise<{ score: VariantScore; runId: string | null }> {
  const { result, runIdByIndex } = await scoreAndLog(
    supabase,
    userId,
    reference,
    [variant],
    opts,
  );
  return { score: result.scores[0], runId: runIdByIndex[0] };
}

// --- internal helpers (all swallow errors — logging must not break UX) -----

async function markFailed(
  supabase: SupabaseClient,
  ids: (string | null)[],
  err: unknown,
) {
  const real = ids.filter((id): id is string => !!id);
  if (real.length === 0) return;
  try {
    await supabase
      .from("mutation_runs")
      .update({
        status: "failed",
        raw_response: {
          error: err instanceof Error ? err.message : String(err),
        },
      })
      .in("id", real);
  } catch (e) {
    console.error("[mutation_runs] failed-update failed:", e);
  }
}

async function updateOne(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  try {
    await supabase.from("mutation_runs").update(patch).eq("id", id);
  } catch (e) {
    console.error("[mutation_runs] completion update failed:", e);
  }
}
