import { NextRequest, NextResponse } from "next/server";
import { foldWithEsmfold } from "@/lib/structures";

// Folding can take tens of seconds; give it room.
export const maxDuration = 120;

// POST /api/structure/esmfold  { sequence: string }
// Folds a novel variant sequence on demand with ESMFold (ESM Atlas).
// Open app: no auth required (external API, no DB).
export async function POST(request: NextRequest) {
  let body: { sequence?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sequence) {
    return NextResponse.json(
      { error: "Missing required field: sequence" },
      { status: 400 },
    );
  }

  try {
    const result = await foldWithEsmfold(body.sequence);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ESMFold failed" },
      { status: 502 },
    );
  }
}
