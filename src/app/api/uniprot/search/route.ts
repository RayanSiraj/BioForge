import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { searchDegradingEnzymes } from "@/lib/uniprot";

// GET /api/uniprot/search?plastic=<name>
// Live UniProtKB search for enzyme candidates associated with a plastic.
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const plastic = request.nextUrl.searchParams.get("plastic");
  if (!plastic) {
    return NextResponse.json(
      { error: "Missing required query param: plastic" },
      { status: 400 },
    );
  }

  try {
    const candidates = await searchDegradingEnzymes(plastic);
    return NextResponse.json({ candidates });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "UniProt search failed" },
      { status: 502 },
    );
  }
}
