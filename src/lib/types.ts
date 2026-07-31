// Shared domain types for BioForge. These mirror the Postgres schema in
// supabase/migrations/0001_init.sql.

export interface Plastic {
  id: string;
  name: string;
  common_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface EnzymeFamily {
  id: string;
  name: string;
  plastic_id: string;
  reference_sequence: string;
  rationale: string | null;
  source_citation: string | null;
  uniprot_id: string | null;
  created_at: string;
}

export interface Variant {
  id: string;
  enzyme_family_id: string;
  sequence: string;
  esm2_score: number | null;
  rank: number | null;
  created_at: string;
}

export type ValidationTier = 1 | 2 | 3;
export type ValidationStatus = "pending" | "passed" | "failed";

export interface ValidationRecord {
  id: string;
  variant_id: string;
  tier: ValidationTier;
  status: ValidationStatus;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const TIER_LABELS: Record<ValidationTier, string> = {
  1: "Computational",
  2: "Colorimetric (Impranil DLN)",
  3: "Wet-lab",
};
