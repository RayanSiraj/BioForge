import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/plastics — list all plastic targets (reference data, public read).
export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plastics")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ plastics: data ?? [] });
}
