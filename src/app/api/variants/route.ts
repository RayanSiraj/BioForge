import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/variants?family=<enzyme_family_id>
// Lists stored variants for a family, best rank first.
export async function GET(request: NextRequest) {
  const family = request.nextUrl.searchParams.get("family");
  if (!family) {
    return NextResponse.json(
      { error: "Missing required query param: family" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("variants")
    .select("*")
    .eq("enzyme_family_id", family)
    .order("rank", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ variants: data ?? [] });
}
