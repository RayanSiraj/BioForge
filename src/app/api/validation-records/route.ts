import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import type { ValidationStatus, ValidationTier } from "@/lib/types";

const VALID_TIERS: ValidationTier[] = [1, 2, 3];
const VALID_STATUS: ValidationStatus[] = ["pending", "passed", "failed"];

// GET /api/validation-records?variant=<id>
// Lists validation records, optionally filtered to one variant.
export async function GET(request: NextRequest) {
  const variant = request.nextUrl.searchParams.get("variant");
  const supabase = createClient();

  let query = supabase
    .from("validation_records")
    .select("*")
    .order("tier", { ascending: true });

  if (variant) query = query.eq("variant_id", variant);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ records: data ?? [] });
}

// POST /api/validation-records
// Body: { variant_id, tier, status?, data? }
// Promotes a variant into the validation pipeline / creates a tier record.
// Upserts on (variant_id, tier) so re-promoting is idempotent.
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    variant_id?: string;
    tier?: number;
    status?: ValidationStatus;
    data?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { variant_id, tier, status = "pending", data = {} } = body;

  if (!variant_id) {
    return NextResponse.json(
      { error: "Missing required field: variant_id" },
      { status: 400 },
    );
  }
  if (!tier || !VALID_TIERS.includes(tier as ValidationTier)) {
    return NextResponse.json(
      { error: "tier must be 1, 2, or 3" },
      { status: 400 },
    );
  }
  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json(
      { error: "status must be pending, passed, or failed" },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { data: record, error } = await supabase
    .from("validation_records")
    .upsert(
      { variant_id, tier, status, data },
      { onConflict: "variant_id,tier" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ record }, { status: 201 });
}

// PATCH /api/validation-records
// Body: { id, status?, data? } — update a tier's status and/or payload.
export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    id?: string;
    status?: ValidationStatus;
    data?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, status, data } = body;
  if (!id) {
    return NextResponse.json(
      { error: "Missing required field: id" },
      { status: 400 },
    );
  }
  if (status && !VALID_STATUS.includes(status)) {
    return NextResponse.json(
      { error: "status must be pending, passed, or failed" },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};
  if (status !== undefined) update.status = status;
  if (data !== undefined) update.data = data;
  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update (provide status and/or data)" },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { data: record, error } = await supabase
    .from("validation_records")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ record });
}
