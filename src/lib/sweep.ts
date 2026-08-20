// ---------------------------------------------------------------------------
// Sweep experiment generation — pure, client-safe. Turns a parent sequence + a
// swept parameter into a list of mutant sequences that each flow through the
// normal single-mutation pipeline (/api/score + /api/structural-check).
// ---------------------------------------------------------------------------

export const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY".split("");

export interface SweepMutation {
  position: number; // 1-indexed
  wt: string;
  mut: string;
}

export interface SweepItem {
  key: string;
  sweptValue: number; // x-axis: residue position, or number of mutations
  mutations: SweepMutation[];
  label: string; // e.g. "S134A" or "S134A+D180N"
  sequence: string;
}

const clean = (s: string) => s.replace(/[^A-Za-z]/g, "").toUpperCase();

export function mutationLabel(muts: SweepMutation[]): string {
  return muts.map((m) => `${m.wt}${m.position}${m.mut}`).join("+");
}

export function applyMutations(
  parentRaw: string,
  muts: { position: number; mut: string }[],
): string {
  const arr = clean(parentRaw).split("");
  for (const m of muts) arr[m.position - 1] = m.mut;
  return arr.join("");
}

function mkItem(
  parent: string,
  sweptValue: number,
  mutations: SweepMutation[],
): SweepItem {
  const label = mutationLabel(mutations);
  return {
    key: label,
    sweptValue,
    mutations,
    label,
    sequence: applyMutations(parent, mutations),
  };
}

const byPosition = (a: SweepMutation, b: SweepMutation) =>
  a.position - b.position;

// --- Mode (a): position sweep ----------------------------------------------

/**
 * One mutation at a time across a residue range. Either a fixed mutant identity
 * (e.g. alanine scan) or all 19 alternate residues at each position.
 */
export function positionSweep(
  parentRaw: string,
  start: number,
  end: number,
  opts: { mode: "fixed" | "all"; target?: string },
): SweepItem[] {
  const parent = clean(parentRaw);
  const lo = Math.max(1, Math.min(start, end));
  const hi = Math.min(parent.length, Math.max(start, end));
  const items: SweepItem[] = [];

  for (let pos = lo; pos <= hi; pos++) {
    const wt = parent[pos - 1];
    if (opts.mode === "fixed") {
      const mut = (opts.target || "A").toUpperCase();
      if (mut === wt) continue; // no-op at this position
      items.push(mkItem(parent, pos, [{ position: pos, wt, mut }]));
    } else {
      for (const mut of AMINO_ACIDS) {
        if (mut === wt) continue;
        items.push(mkItem(parent, pos, [{ position: pos, wt, mut }]));
      }
    }
  }
  return items;
}

// --- Mode (b): combined-mutation sweep -------------------------------------

/** Parse a candidate pool string like "S134A D180N T88V" (space/comma sep). */
export function parsePool(
  parentRaw: string,
  poolStr: string,
): { muts: SweepMutation[]; errors: string[] } {
  const parent = clean(parentRaw);
  const tokens = poolStr
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const muts: SweepMutation[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const re = /^([A-Za-z])?(\d+)([A-Za-z])$/;

  for (const t of tokens) {
    const m = re.exec(t);
    if (!m) {
      errors.push(`"${t}" — expected e.g. S134A`);
      continue;
    }
    const pos = parseInt(m[2], 10);
    if (pos < 1 || pos > parent.length) {
      errors.push(`"${t}" — position out of range (1–${parent.length})`);
      continue;
    }
    const wt = parent[pos - 1];
    const mut = m[3].toUpperCase();
    if (!AMINO_ACIDS.includes(mut)) {
      errors.push(`"${t}" — "${mut}" is not a standard residue`);
      continue;
    }
    if (m[1] && m[1].toUpperCase() !== wt) {
      errors.push(`"${t}" — wild-type is ${wt}${pos}, not ${m[1].toUpperCase()}`);
      continue;
    }
    if (mut === wt) {
      errors.push(`"${t}" — mutant equals wild-type`);
      continue;
    }
    const id = `${pos}${mut}`;
    if (seen.has(id)) continue;
    seen.add(id);
    muts.push({ position: pos, wt, mut });
  }
  return { muts, errors };
}

function* kCombinations<T>(arr: T[], k: number): Generator<T[]> {
  const n = arr.length;
  if (k > n || k <= 0) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

// Even-stride sample to keep a representative spread without bias.
function sampleEvenly<T>(arr: T[], k: number): T[] {
  if (arr.length <= k) return arr;
  const out: T[] = [];
  const step = arr.length / k;
  for (let i = 0; i < k; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

/**
 * Combinations of sizes 1..maxN drawn from a candidate pool. The total is capped
 * (balanced across sizes) so the batch stays runnable; the swept parameter is
 * the number of combined mutations.
 */
export function combinationSweep(
  parentRaw: string,
  pool: SweepMutation[],
  maxN: number,
  cap: number,
): SweepItem[] {
  const parent = clean(parentRaw);
  const sizes = Math.min(maxN, pool.length);
  if (sizes < 1) return [];
  const perSize = Math.max(1, Math.floor(cap / sizes));
  const items: SweepItem[] = [];

  for (let n = 1; n <= sizes; n++) {
    const combos: SweepMutation[][] = [];
    for (const combo of kCombinations(pool, n)) {
      // Can't combine two mutations at the same position.
      if (new Set(combo.map((m) => m.position)).size === combo.length) {
        combos.push(combo);
      }
    }
    for (const c of sampleEvenly(combos, perSize)) {
      items.push(mkItem(parent, n, [...c].sort(byPosition)));
    }
  }
  return items;
}

// --- Beeswarm x-offsets: spread points that share an x so distributions read
//     clearly (used by the results scatter). Deterministic, not random. -------

export function withBeeswarmX<T extends { sweptValue: number }>(
  points: T[],
  spread = 0.72,
): (T & { x: number })[] {
  const groups = new Map<number, T[]>();
  for (const p of points) {
    const g = groups.get(p.sweptValue) ?? [];
    g.push(p);
    groups.set(p.sweptValue, g);
  }
  const out: (T & { x: number })[] = [];
  for (const [value, g] of groups) {
    const n = g.length;
    g.forEach((p, i) => {
      const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread;
      out.push({ ...p, x: value + offset });
    });
  }
  return out;
}
