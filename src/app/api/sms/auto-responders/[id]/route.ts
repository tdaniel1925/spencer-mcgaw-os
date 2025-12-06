import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE - Delete auto-responder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("sms_auto_responders")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete auto-responder" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting auto-responder:", error);
    return NextResponse.json({ error: "Failed to delete auto-responder" }, { status: 500 });
  }
}

// PUT - Update auto-responder
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { data: autoResponder, error } = await supabase
      .from("sms_auto_responders")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update auto-responder" }, { status: 500 });
    }

    return NextResponse.json(autoResponder);
  } catch (error) {
    console.error("Error updating auto-responder:", error);
    return NextResponse.json({ error: "Failed to update auto-responder" }, { status: 500 });
  }
}
