import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List deadlines for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const upcoming = searchParams.get("upcoming") === "true";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    let query = supabase
      .from("client_deadlines")
      .select(`
        *,
        filing:client_tax_filings(id, filing_type, status)
      `)
      .eq("client_id", clientId);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (upcoming) {
      const today = new Date().toISOString().split("T")[0];
      query = query.gte("due_date", today).neq("status", "completed");
    }

    const { data: deadlines, error } = await query.order("due_date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ deadlines });
  } catch (error) {
    console.error("Error fetching deadlines:", error);
    return NextResponse.json({ error: "Failed to fetch deadlines" }, { status: 500 });
  }
}

// POST - Create a new deadline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      deadline_type,
      title,
      description,
      due_date,
      reminder_days,
      assigned_to,
      tax_year,
      linked_filing_id,
    } = body;

    const { data: deadline, error } = await supabase
      .from("client_deadlines")
      .insert({
        client_id: clientId,
        deadline_type,
        title,
        description,
        due_date,
        reminder_days: reminder_days || [7, 3, 1],
        status: "upcoming",
        assigned_to,
        tax_year,
        linked_filing_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ deadline }, { status: 201 });
  } catch (error) {
    console.error("Error creating deadline:", error);
    return NextResponse.json({ error: "Failed to create deadline" }, { status: 500 });
  }
}
