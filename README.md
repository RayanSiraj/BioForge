# BioForge

AI-driven plastic-degrading enzyme discovery & validation. Next.js 14 (App
Router) + Supabase + TypeScript.

## User flow

1. **Plastic** (`/`) — pick a target plastic.
2. **Families** (`/families`) — see known/candidate enzyme families (curated
   *reference* data, not authoritative).
3. **Variants** (`/variants`) — generate point-mutation variants of a family's
   reference sequence, score each with ESM-2 (HuggingFace Inference API), rank,
   and promote the best into validation.
4. **Validation** (`/validation`) — track each promoted variant through three
   tiers: computational, colorimetric (Impranil DLN turbidity), wet-lab.

## Setup

### 1. Install

```bash
cd bioforge
npm install
```

### 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your
  Supabase project (Settings → API).
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, from the same page.
- `HF_API_TOKEN` — a HuggingFace token (Settings → Access Tokens). **Optional:**
  if unset, ESM-2 scoring falls back to a deterministic local mock so the whole
  flow still works end-to-end.
- `ESM2_MODEL` — defaults to `facebook/esm2_t6_8M_UR50D`.

Nothing is hardcoded — all secrets come from the environment (`src/lib/env.ts`).

### 3. Database

Run the schema then the seed against your Supabase Postgres. Easiest is the
Supabase SQL editor — paste and run in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/seed.sql`

Or with the Supabase CLI:

```bash
supabase db push          # if you wire these into a migrations workflow
# or just: psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
#          psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

### 4. Auth

Single-user MVP uses Supabase email/password. Create your user either in the
Supabase dashboard (Authentication → Users → Add user) or via the in-app
**Sign up** on `/login`. For local dev you may want to disable email
confirmation (Auth → Providers → Email → "Confirm email" off).

### 5. Run

```bash
npm run dev
# http://localhost:3000
```

## Architecture notes

- **ESM-2 is isolated** in `src/lib/esm2.ts`. The rest of the app only calls
  `scoreVariants(reference, variants)`. Swap the scoring approach (true
  pseudo-perplexity, a local model, a different endpoint) by editing only that
  file — the interface stays the same. Current MVP proxy: cosine similarity of
  mean-pooled ESM-2 embeddings vs. the reference sequence.
- **Variant generation** is `src/lib/variants.ts` — intentionally simple random
  point substitutions. Not biologically clever; just produces N candidates.
- **Supabase clients**: `src/lib/supabase/client.ts` (browser),
  `server.ts` (Server Components / Route Handlers, plus an admin client using
  the service-role key), and `middleware.ts` (session refresh + route
  protection, wired from `src/middleware.ts`).

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/plastics` | list plastics |
| GET | `/api/enzyme-families?plastic=<id\|name>` | families for a plastic |
| GET | `/api/variants?family=<id>` | stored variants for a family |
| POST | `/api/variants/generate` | generate + score + store variants |
| GET | `/api/validation-records[?variant=<id>]` | list validation records |
| POST | `/api/validation-records` | promote/create a tier record (upsert) |
| PATCH | `/api/validation-records` | update a tier's status/data |

## Data model

`plastics` → `enzyme_families` (FK) → `variants` (FK) → `validation_records`
(FK). See `supabase/migrations/0001_init.sql`. RLS: reference tables are
world-readable; `variants` / `validation_records` require an authenticated user.

## ⚠️ On the seed data

The plastic → enzyme-family mapping and reference sequences in
`supabase/seed.sql` are **curated starting references, not authoritative**. PET
families (PETase/MHETase/cutinase) are well established; PU (esterases/ureases)
and especially PE/PP (laccases/Mn peroxidases) are **emerging/speculative** and
flagged as such in each row. Verify every sequence against its cited UniProt
accession before using it for real analysis.
