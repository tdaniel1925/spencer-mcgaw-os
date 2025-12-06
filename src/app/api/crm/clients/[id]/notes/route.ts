import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List notes for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const noteType = searchParams.get("type");
  const pinnedOnly = searchParams.get("pinned") === "true";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    let query = supabase
      .from("client_notes")
      .select(`
        *,
        contact:client_contacts(id, first_name, last_name)
      `)
      .eq("client_id", clientId)
      .or(`is_private.eq.false,user_id.eq.${user.id}`);

    if (noteType && noteType !== "all") {
      query = query.eq("note_type", noteType);
    }

    if (pinnedOnly) {
      query = query.eq("is_pinned", true);
    }

    const { data: notes, error } = await query
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get user info for the notes
    const userIds = [...new Set(notes?.map(n => n.user_id) || [])];
    let usersMap: Record<string, { full_name: string; avatar_url: string }> = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      usersMap = (users || []).reduce((acc, u) => {
        acc[u.id] = { full_name: u.full_name, avatar_url: u.avatar_url };
        return acc;
      }, {} as Record<string, { full_name: string; avatar_url: string }>);
    }

    // Enrich notes with user info
    const enrichedNotes = notes?.map(note => ({
      ...note,
      user: usersMap[note.user_id] || { full_name: "Unknown User", avatar_url: null },
    }));

    return NextResponse.json({ notes: enrichedNotes });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

// POST - Create a new note
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
      contact_id,
      note_type,
      subject,
      content,
      is_pinned,
      is_private,
      follow_up_date,
      follow_up_assigned_to,
      attachments,
      mentioned_users,
    } = body;

    const { data: note, error } = await supabase
      .from("client_notes")
      .insert({
        client_id: clientId,
        contact_id,
        user_id: user.id,
        note_type: note_type || "general",
        subject,
        content,
        is_pinned: is_pinned || false,
        is_private: is_private || false,
        follow_up_date,
        follow_up_assigned_to,
        attachments: attachments || [],
        mentioned_users: mentioned_users || [],
      })
      .select()
      .single();

    if (error) throw error;

    // Get user info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      note: {
        ...note,
        user: profile || { full_name: "Unknown User", avatar_url: null },
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
