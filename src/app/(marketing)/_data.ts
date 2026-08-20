// Landing content data. Kept separate so it's trivial to edit as the build
// progresses. IMPORTANT: no scientific efficacy claims here — only build/process
// status. Program statuses below are neutral placeholders; set the real ones.

export type Status = "done" | "active" | "planned";

export interface Milestone {
  title: string;
  detail: string;
  status: Status;
}

// Build milestones — reflect the actual state of the project.
export const MILESTONES: Milestone[] = [
  {
    title: "Data model & schema",
    detail:
      "Postgres schema for plastics, enzyme families, variants and validation records, with row-level security.",
    status: "done",
  },
  {
    title: "Curated enzyme reference set",
    detail:
      "Seed families mapped to target plastics, each traceable to a cited UniProt accession and publication.",
    status: "done",
  },
  {
    title: "ESM scoring pipeline",
    detail:
      "Variant generation with ESM-1v triage and ESM-2 predicted-stability scoring via the HuggingFace Inference API.",
    status: "active",
  },
  {
    title: "Structure & 3D viewer",
    detail:
      "Parent structures from AlphaFold DB; novel variants folded on demand with ESMFold, rendered in an interactive viewer.",
    status: "active",
  },
  {
    title: "Confidence & export",
    detail:
      "Per-residue pLDDT, predicted-stability readouts and a plain-language computational verdict, exportable as a single package.",
    status: "planned",
  },
];

export interface Tier {
  n: 1 | 2 | 3;
  name: string;
  method: string;
  status: Status;
}

// The three-tier validation framework — shown as build status, not results.
export const TIERS: Tier[] = [
  {
    n: 1,
    name: "Computational",
    method: "Sequence + structure modelling (ESM, ESMFold, AlphaFold)",
    status: "active",
  },
  {
    n: 2,
    name: "Colorimetric",
    method: "Impranil DLN turbidity assay",
    status: "planned",
  },
  {
    n: 3,
    name: "Wet-lab",
    method: "Benchtop degradation confirmation",
    status: "planned",
  },
];

export interface Program {
  name: string;
  context: string;
  status: string; // free text — set the real status
}

// Program / competition tracker. Placeholders — replace with real statuses.
export const PROGRAMS: Program[] = [
  { name: "Built With Claude", context: "Anthropic", status: "In progress" },
  { name: "HackMIT", context: "Hackathon", status: "Planned" },
  { name: "DECA", context: "Competition", status: "Planned" },
];

// The pipeline, framed as process (marketing overview, not efficacy claims).
export const PIPELINE = [
  {
    k: "01",
    title: "Target",
    body: "Choose a plastic — PET, PU, PLA and more.",
  },
  {
    k: "02",
    title: "Match",
    body: "Surface published enzyme families with source citations.",
  },
  {
    k: "03",
    title: "Model",
    body: "Score candidate variants with ESM-1v and ESM-2.",
  },
  {
    k: "04",
    title: "Fold",
    body: "Render parent and variant structures in 3D.",
  },
  {
    k: "05",
    title: "Verdict",
    body: "Read a confidence-scored computational prediction.",
  },
];

// Real tooling the product is built on — factual credibility strip.
export const STACK = [
  "ESM-2",
  "ESM-1v",
  "ESMFold",
  "AlphaFold DB",
  "UniProt",
  "Supabase",
];
