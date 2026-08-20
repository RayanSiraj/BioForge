-- Persistent run-logging for every ESM mutation-prediction call.
-- One row per scored variant (per input sequence + mutation set): a pending row
-- is inserted before the HF Inference call and updated to completed/failed after,
-- so logging is server-side and cannot be dropped by a slow/interrupted client.

create table if not exists public.mutation_runs (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  -- FK to Supabase auth users; null if the user is later deleted.
  user_id               uuid references auth.users (id) on delete set null,
  input_sequence        text not null,          -- parent / wild-type sequence
  mutation_spec         jsonb not null,         -- [{ position, wt, mut }, ...]
  model_name            text not null,          -- e.g. facebook/esm2_t33_650M_UR50D
  model_version         text,                   -- nullable (tier / revision)
  -- Nullable because pending rows have no score yet; set on completion.
  predicted_score       numeric,
  score_type            text not null,          -- e.g. "esm_pll" (summed masked-marginal Δ)
  structural_confidence numeric,                -- placeholder for prompt #3 (e.g. mean pLDDT)
  status                text not null default 'pending'
                          check (status in ('pending', 'completed', 'failed')),
  raw_response          jsonb                    -- full scoring payload for debugging
);

create index if not exists mutation_runs_created_at_idx
  on public.mutation_runs (created_at desc);
create index if not exists mutation_runs_model_name_idx
  on public.mutation_runs (model_name);
create index if not exists mutation_runs_user_id_idx
  on public.mutation_runs (user_id);

-- RLS: readable/writable by any authenticated user (single-user MVP, matches
-- the variants/validation_records policy). Writes happen server-side.
alter table public.mutation_runs enable row level security;

drop policy if exists "mutation_runs auth all" on public.mutation_runs;
create policy "mutation_runs auth all" on public.mutation_runs
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
