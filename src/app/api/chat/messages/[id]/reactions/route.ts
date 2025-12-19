import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/chat/messages/[id]/reactions - Get reactions for a message
export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: messageId } = await params;

  try {
    const { data: reactions, error } = await supabase
      .from("chat_message_reactions")
      .select(`
        *,
        user:user_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("message_id", messageId);

    if (error) throw error;

    return NextResponse.json({ reactions: reactions || [] });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }
}

// POST /api/chat/messages/[id]/reactions - Add a reaction
export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: messageId } = await params;

  try {
    const body = await request.json();
    const { emoji } = body;

    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
    }

    // Check if reaction already exists
    const { data: existing } = await supabase
      .from("chat_message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Reaction already exists" }, { status: 409 });
    }

    // Insert the reaction
    const { data: reaction, error } = await supabase
      .from("chat_message_reactions")
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji
      })
      .select(`
        *,
        user:user_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ reaction });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return NextResponse.json({ error: "Failed to add reaction" }, { status: 500 });
  }
}

// DELETE /api/chat/messages/[id]/reactions - Remove a reaction
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: messageId } = await params;
  const emoji = request.nextUrl.searchParams.get("emoji");

  if (!emoji) {
    return NextResponse.json({ error: "Emoji query parameter is required" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("chat_message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing reaction:", error);
    return NextResponse.json({ error: "Failed to remove reaction" }, { status: 500 });
  }
}
