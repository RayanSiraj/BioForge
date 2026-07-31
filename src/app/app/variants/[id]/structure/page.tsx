import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StructureWorkbench } from "./_components/StructureWorkbench";

export default async function VariantWorkbenchPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: variant, error } = await supabase
    .from("variants")
    .select(
      "id, sequence, esm2_score, rank, enzyme_family_id, enzyme_families(name, reference_sequence, uniprot_id)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!variant) notFound();

  const family = Array.isArray(variant.enzyme_families)
    ? variant.enzyme_families[0]
    : variant.enzyme_families;

  return (
    <div>
      <Link
        href="/app/variants"
        className="text-sm font-medium text-signal-700 hover:underline"
      >
        ← Variants
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          Workbench — {family?.name ?? "variant"}
        </h1>
        <span className="font-mono text-sm text-slate-500">
          rank {variant.rank ?? "—"}
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Edit residues, re-score with ESM-2, fold with ESMFold, and read a
        computational verdict. Predictions triage candidates for testing — they
        do not establish activity or safety.
      </p>

      <StructureWorkbench
        familyId={variant.enzyme_family_id}
        parentSequence={family?.reference_sequence ?? ""}
        parentUniprot={family?.uniprot_id ?? null}
        initialSequence={variant.sequence}
      />
    </div>
  );
}
