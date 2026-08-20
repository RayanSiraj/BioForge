-- Structural self-consistency metric for mutation runs: Cα RMSD of the
-- predicted mutant active-site region superposed on the wild-type reference
-- structure (see prompt #3). structural_confidence (added in 0003) holds the
-- mutant's mean pLDDT; this adds the active-site RMSD alongside it.

alter table public.mutation_runs
  add column if not exists active_site_rmsd numeric;

comment on column public.mutation_runs.active_site_rmsd is
  'Cα RMSD (Å) of the predicted mutant active-site region superposed on the wild-type reference structure. NULL when not applicable (non-PETase reference) or not computed.';
