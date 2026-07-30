import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/enzyme-families?plastic=<id|name>
// Returns enzyme families for a plastic. `plastic` may be the plastic UUID or
// its short name (e.g. "PET").
export async function GET(request: NextRequest) {
  const plastic = request.nextUrl.searchParams.get("plastic");
  if (!plastic) {
    return NextResponse.json(
      { error: "Missing required query param: plastic" },
      { status: 400 },
    );
  }

  const supabase = createClient();

  // Resolve name -> id if a non-UUID was passed.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      plastic,
    );

  let plasticId = plastic;
  if (!isUuid) {
    const { data: p, error: pErr } = await supabase
      .from("plastics")
      .select("id")
      .eq("name", plastic)
      .maybeSingle();
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }
    if (!p) {
      return NextResponse.json(
        { error: `No plastic found for "${plastic}"` },
        { status: 404 },
      );
    }
    plasticId = p.id;
  }

  const { data, error } = await supabase
    .from("enzyme_families")
    .select("*")
    .eq("plastic_id", plasticId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ families: data ?? [] });
}
