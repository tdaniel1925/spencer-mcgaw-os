import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const before = searchParams.get("before"); // For pagination

  try {
    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from("sms_conversations")
      .select(`
        *,
        contact:client_contacts!contact_id (
          id,
          first_name,
          last_name,
          email,
          phone,
          mobile,
          title,
          is_primary
        ),
        client:clients!client_id (
          id,
          name,
          email,
          phone
        )
      `)
      .eq("id", id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Get messages
    let messagesQuery = supabase
      .from("sms_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      messagesQuery = messagesQuery.lt("created_at", before);
    }

    const { data: messages, error: msgError } = await messagesQuery;

    if (msgError) {
      console.error("Error fetching messages:", msgError);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    // Mark messages as read
    if (conversation.unread_count > 0) {
      await supabase
        .from("sms_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", id)
        .eq("direction", "inbound")
        .is("read_at", null);

      await supabase
        .from("sms_conversations")
        .update({ unread_count: 0 })
        .eq("id", id);
    }

    return NextResponse.json({
      conversation,
      messages: messages?.reverse() || [], // Reverse to show oldest first
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

// PUT - Update conversation (archive, assign, priority, etc.)
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
    const allowedFields = ["is_archived", "assigned_to", "is_priority", "tags", "status"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: conversation, error } = await supabase
      .from("sms_conversations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating conversation:", error);
      return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
