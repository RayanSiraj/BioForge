-- Add a clean UniProt accession to enzyme_families so parent structures can be
-- resolved from AlphaFold DB. Only the well-established PET families get a real,
-- verifiable accession; emerging PU/PE/PP candidates stay NULL (the UI shows an
-- honest "no reference structure" state rather than a mismatched model).

alter table public.enzyme_families
  add column if not exists uniprot_id text;

comment on column public.enzyme_families.uniprot_id is
  'UniProt accession for the reference/parent enzyme (AlphaFold DB lookup). NULL when no verified accession exists.';

-- Backfill the established PET families.
update public.enzyme_families set uniprot_id = 'A0A0K8P6T7' where name = 'PETase';
update public.enzyme_families set uniprot_id = 'A0A0K8P8E7' where name = 'MHETase';
update public.enzyme_families set uniprot_id = 'G9BY57'     where name = 'Cutinase (LCC)';
