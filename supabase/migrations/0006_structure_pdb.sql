-- Keep the ESMFold-predicted mutant structure so the 3D viewer can render it
-- without re-folding. The structural-consistency check (prompt #3) already folds
-- this structure in-memory; we now persist the PDB text for interactive runs.

alter table public.mutation_runs
  add column if not exists structure_pdb text;

comment on column public.mutation_runs.structure_pdb is
  'ESMFold-predicted mutant structure (PDB text) from the structural-consistency check, kept for the 3D viewer. Persisted for interactive (non-sweep) runs; NULL otherwise or when folding failed.';
