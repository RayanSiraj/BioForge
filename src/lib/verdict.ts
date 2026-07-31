// ---------------------------------------------------------------------------
// Verdict synthesis — combines the two computational signals (ESM-2
// masked-marginal likelihood + ESMFold pLDDT) into a structured, plain-language
// read. This is a TRIAGE signal for prioritising wet-lab testing, NOT evidence
// that an enzyme works or is safe. Every verdict carries that caveat.
// ---------------------------------------------------------------------------

import type { MutationScore } from "@/lib/esm2";

export type VerdictTone = "favorable" | "tolerated" | "risky" | "inconclusive";

export interface VerdictInput {
  esmScore: number | null; // summed masked-marginal delta
  mutations: MutationScore[];
  meanPlddt: number | null; // variant ESMFold mean pLDDT (0–100)
  mutatedResiduePlddt: { position: number; plddt: number | null }[];
}

export interface Verdict {
  tone: VerdictTone;
  headline: string;
  signals: string[]; // what the computation shows
  caveats: string[]; // what it does NOT establish
}

const ALWAYS_CAVEATS = [
  "This is a computational prediction, not a measurement — it does not show the enzyme degrades its target.",
  "It says nothing about catalytic activity, expression, solubility, byproducts, or safety/side effects.",
  "Confirmation requires Tier 2 (Impranil DLN colorimetric) and Tier 3 (wet-lab) validation.",
];

export function buildVerdict(input: VerdictInput): Verdict {
  const { esmScore, mutations, meanPlddt, mutatedResiduePlddt } = input;

  if (esmScore === null || mutations.length === 0) {
    return {
      tone: "inconclusive",
      headline: "No mutations to assess",
      signals: ["This sequence is identical to the parent."],
      caveats: ALWAYS_CAVEATS,
    };
  }

  const signals: string[] = [];

  // ESM-2 likelihood signal.
  const favored = mutations.filter((m) => m.delta > 0);
  const stronglyDisfavored = mutations.filter((m) => m.delta < -3);
  if (esmScore > 0) {
    signals.push(
      `ESM-2 favours these substitutions overall (summed score +${esmScore.toFixed(2)}).`,
    );
  } else if (esmScore > -2 * mutations.length) {
    signals.push(
      `ESM-2 scores the substitutions mildly below wild-type (${esmScore.toFixed(2)}) — plausibly tolerated.`,
    );
  } else {
    signals.push(
      `ESM-2 scores the substitutions well below wild-type (${esmScore.toFixed(2)}) — likely destabilising.`,
    );
  }
  if (favored.length > 0) {
    signals.push(
      `Favoured position${favored.length > 1 ? "s" : ""}: ${favored
        .map((m) => `${m.from}${m.position}${m.to}`)
        .join(", ")}.`,
    );
  }
  if (stronglyDisfavored.length > 0) {
    signals.push(
      `Poorly tolerated: ${stronglyDisfavored
        .map((m) => `${m.from}${m.position}${m.to}`)
        .join(", ")}.`,
    );
  }

  // pLDDT fold-confidence signal.
  if (meanPlddt != null) {
    const band =
      meanPlddt >= 90
        ? "very high"
        : meanPlddt >= 70
          ? "confident"
          : meanPlddt >= 50
            ? "low"
            : "very low";
    signals.push(
      `ESMFold predicts the variant's structure with ${band} confidence (mean pLDDT ${meanPlddt}).`,
    );
  }
  const lowLocal = mutatedResiduePlddt.filter(
    (r) => r.plddt != null && r.plddt < 70,
  );
  if (lowLocal.length > 0) {
    signals.push(
      `${lowLocal.length} mutated residue${lowLocal.length > 1 ? "s sit" : " sits"} in a low-confidence region.`,
    );
  }

  // Tone: combine both signals conservatively.
  let tone: VerdictTone;
  const foldOk = meanPlddt == null || meanPlddt >= 70;
  if (stronglyDisfavored.length > 0 || (meanPlddt != null && meanPlddt < 50)) {
    tone = "risky";
  } else if (esmScore > 0 && foldOk) {
    tone = "favorable";
  } else if (esmScore > -2 * mutations.length && foldOk) {
    tone = "tolerated";
  } else {
    tone = "risky";
  }

  const headline =
    tone === "favorable"
      ? "Worth prioritising for testing"
      : tone === "tolerated"
        ? "Plausible candidate for testing"
        : "Lower-priority candidate";

  return { tone, headline, signals, caveats: ALWAYS_CAVEATS };
}
