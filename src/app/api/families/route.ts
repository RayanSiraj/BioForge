import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

// GET /api/families — list enzyme families for the Sweep parent selector.
// Returns the reference sequence so the client can generate mutant sequences
// that flow through the normal single-mutation pipeline.
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("enzyme_families")
    .select("id, name, uniprot_id, reference_sequence")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ families: data ?? [] });
}
