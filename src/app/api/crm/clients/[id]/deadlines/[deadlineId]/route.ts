import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get single deadline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deadlineId: string }> }
) {
  const { id: clientId, deadlineId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: deadline, error } = await supabase
      .from("client_deadlines")
      .select("*")
      .eq("id", deadlineId)
      .eq("client_id", clientId)
      .single();

    if (error) {
      return NextResponse.json({ error: "Deadline not found" }, { status: 404 });
    }

    return NextResponse.json(deadline);
  } catch (error) {
    console.error("Error fetching deadline:", error);
    return NextResponse.json({ error: "Failed to fetch deadline" }, { status: 500 });
  }
}

// PUT - Update deadline
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deadlineId: string }> }
) {
  const { id: clientId, deadlineId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { data: deadline, error } = await supabase
      .from("client_deadlines")
      .update(body)
      .eq("id", deadlineId)
      .eq("client_id", clientId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update deadline" }, { status: 500 });
    }

    return NextResponse.json(deadline);
  } catch (error) {
    console.error("Error updating deadline:", error);
    return NextResponse.json({ error: "Failed to update deadline" }, { status: 500 });
  }
}

// DELETE - Delete deadline
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deadlineId: string }> }
) {
  const { id: clientId, deadlineId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("client_deadlines")
      .delete()
      .eq("id", deadlineId)
      .eq("client_id", clientId);

    if (error) {
      return NextResponse.json({ error: "Failed to delete deadline" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deadline:", error);
    return NextResponse.json({ error: "Failed to delete deadline" }, { status: 500 });
  }
}
