import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List notes for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: notes, error } = await supabase
      .from("project_notes")
      .select(`
        *,
        user:user_profiles!project_notes_user_id_fkey(id, email, full_name)
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ notes: notes || [] });
  } catch (error) {
    console.error("Error fetching project notes:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

// POST - Create a new note for a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content, note_type } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Note content is required" }, { status: 400 });
    }

    const { data: note, error } = await supabase
      .from("project_notes")
      .insert({
        project_id: projectId,
        user_id: user.id,
        content: content.trim(),
        note_type: note_type || "general",
      })
      .select(`
        *,
        user:user_profiles!project_notes_user_id_fkey(id, email, full_name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Error creating project note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}

// DELETE - Delete a note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json({ error: "noteId is required" }, { status: 400 });
    }

    // Verify the note belongs to this project and user owns it (or is admin)
    const { data: note } = await supabase
      .from("project_notes")
      .select("user_id")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .single();

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Get user role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "owner" || profile?.role === "admin";
    const isOwner = note.user_id === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { error } = await supabase
      .from("project_notes")
      .delete()
      .eq("id", noteId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
