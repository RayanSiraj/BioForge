-- BioForge schema — plastic-degrading enzyme discovery & validation
-- Run against your Supabase Postgres (SQL editor, or supabase db push).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- plastics
-- ---------------------------------------------------------------------------
create table if not exists public.plastics (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,          -- e.g. "PET"
  common_name  text,                          -- e.g. "Polyethylene terephthalate"
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- enzyme_families
-- ---------------------------------------------------------------------------
create table if not exists public.enzyme_families (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  plastic_id         uuid not null references public.plastics (id) on delete cascade,
  reference_sequence text not null,           -- canonical amino-acid sequence
  rationale          text,                    -- why this family degrades this plastic
  source_citation    text,                    -- reference/starting citation
  created_at         timestamptz not null default now(),
  unique (plastic_id, name)
);

create index if not exists enzyme_families_plastic_id_idx
  on public.enzyme_families (plastic_id);

-- ---------------------------------------------------------------------------
-- variants
-- ---------------------------------------------------------------------------
create table if not exists public.variants (
  id                uuid primary key default gen_random_uuid(),
  enzyme_family_id  uuid not null references public.enzyme_families (id) on delete cascade,
  sequence          text not null,
  esm2_score        double precision,         -- proxy stability score (nullable until scored)
  rank              integer,                   -- 1 = best within its family batch
  created_at        timestamptz not null default now()
);

create index if not exists variants_enzyme_family_id_idx
  on public.variants (enzyme_family_id);
create index if not exists variants_rank_idx
  on public.variants (enzyme_family_id, rank);

-- ---------------------------------------------------------------------------
-- validation_records
-- ---------------------------------------------------------------------------
-- tier: 1 = computational, 2 = colorimetric (Impranil DLN turbidity), 3 = wet-lab
create table if not exists public.validation_records (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references public.variants (id) on delete cascade,
  tier        smallint not null check (tier in (1, 2, 3)),
  status      text not null default 'pending' check (status in ('pending', 'passed', 'failed')),
  data        jsonb not null default '{}'::jsonb,   -- tier-specific fields
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (variant_id, tier)
);

create index if not exists validation_records_variant_id_idx
  on public.validation_records (variant_id);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists validation_records_set_updated_at on public.validation_records;
create trigger validation_records_set_updated_at
  before update on public.validation_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Reference data (plastics, enzyme_families) is world-readable.
-- User-generated data (variants, validation_records) is readable/writable by
-- any authenticated user for this single-user MVP. Tighten later with per-user
-- ownership columns if this becomes multi-tenant.

alter table public.plastics            enable row level security;
alter table public.enzyme_families     enable row level security;
alter table public.variants            enable row level security;
alter table public.validation_records  enable row level security;

drop policy if exists "plastics readable" on public.plastics;
create policy "plastics readable" on public.plastics
  for select using (true);

drop policy if exists "enzyme_families readable" on public.enzyme_families;
create policy "enzyme_families readable" on public.enzyme_families
  for select using (true);

drop policy if exists "variants auth all" on public.variants;
create policy "variants auth all" on public.variants
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "validation auth all" on public.validation_records;
create policy "validation auth all" on public.validation_records
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
