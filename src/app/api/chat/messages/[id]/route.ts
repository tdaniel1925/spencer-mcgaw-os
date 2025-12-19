import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/chat/messages/[id] - Edit a message
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: messageId } = await params;

  try {
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // Verify user owns the message
    const { data: message, error: fetchError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (message.user_id !== user.id) {
      return NextResponse.json({ error: "Cannot edit another user's message" }, { status: 403 });
    }

    if (message.is_deleted) {
      return NextResponse.json({ error: "Cannot edit a deleted message" }, { status: 400 });
    }

    // Update the message
    const { data: updated, error: updateError } = await supabase
      .from("chat_messages")
      .update({
        content: content.trim(),
        original_content: message.original_content || message.content,
        edited_at: new Date().toISOString(),
        is_edited: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ message: updated });
  } catch (error) {
    console.error("Error editing message:", error);
    return NextResponse.json({ error: "Failed to edit message" }, { status: 500 });
  }
}

// DELETE /api/chat/messages/[id] - Soft delete a message
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: messageId } = await params;

  try {
    // Verify user owns the message
    const { data: message, error: fetchError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (message.user_id !== user.id) {
      return NextResponse.json({ error: "Cannot delete another user's message" }, { status: 403 });
    }

    // Soft delete the message
    const { error: deleteError } = await supabase
      .from("chat_messages")
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
