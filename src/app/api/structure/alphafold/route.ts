import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { fetchAlphaFold } from "@/lib/structures";

export const maxDuration = 60;

// GET /api/structure/alphafold?uniprot=<accession>
// Returns the precomputed AlphaFold structure for a reference enzyme.
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const uniprot = request.nextUrl.searchParams.get("uniprot");
  if (!uniprot) {
    return NextResponse.json(
      { error: "Missing required query param: uniprot" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchAlphaFold(uniprot);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AlphaFold lookup failed" },
      { status: 502 },
    );
  }
}
