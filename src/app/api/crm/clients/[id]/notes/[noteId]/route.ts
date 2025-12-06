import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get a specific note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { noteId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: note, error } = await supabase
      .from("client_notes")
      .select(`
        *,
        contact:client_contacts(id, first_name, last_name)
      `)
      .eq("id", noteId)
      .or(`is_private.eq.false,user_id.eq.${user.id}`)
      .single();

    if (error) throw error;

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Error fetching note:", error);
    return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 });
  }
}

// PUT - Update a note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { noteId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Check if user owns the note or is admin
    const { data: existingNote } = await supabase
      .from("client_notes")
      .select("user_id")
      .eq("id", noteId)
      .single();

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Only allow the creator to edit (could add admin check here)
    if (existingNote.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to edit this note" }, { status: 403 });
    }

    const body = await request.json();
    const {
      contact_id,
      note_type,
      subject,
      content,
      is_pinned,
      is_private,
      follow_up_date,
      follow_up_assigned_to,
      follow_up_completed,
      attachments,
      mentioned_users,
    } = body;

    const { data: note, error } = await supabase
      .from("client_notes")
      .update({
        contact_id,
        note_type,
        subject,
        content,
        is_pinned,
        is_private,
        follow_up_date,
        follow_up_assigned_to,
        follow_up_completed,
        attachments,
        mentioned_users,
      })
      .eq("id", noteId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Error updating note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

// DELETE - Delete a note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { noteId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Check if user owns the note
    const { data: existingNote } = await supabase
      .from("client_notes")
      .select("user_id")
      .eq("id", noteId)
      .single();

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (existingNote.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this note" }, { status: 403 });
    }

    const { error } = await supabase
      .from("client_notes")
      .delete()
      .eq("id", noteId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
