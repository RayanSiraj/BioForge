import { NextRequest, NextResponse } from "next/server";
import { searchDegradingEnzymes } from "@/lib/uniprot";

// GET /api/uniprot/search?plastic=<name>
// Live UniProtKB search for enzyme candidates associated with a plastic.
// Open app: no auth required (external API, no DB).
export async function GET(request: NextRequest) {
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
