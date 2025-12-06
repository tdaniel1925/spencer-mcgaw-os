import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all conversations
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";
  const assignedTo = searchParams.get("assigned_to");
  const unreadOnly = searchParams.get("unread_only") === "true";
  const clientId = searchParams.get("client_id");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("sms_conversations")
      .select(`
        *,
        contact:client_contacts!contact_id (
          id,
          first_name,
          last_name,
          email,
          phone,
          mobile
        ),
        client:clients!client_id (
          id,
          name
        )
      `)
      .eq("is_archived", status === "archived")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (status === "active") {
      query = query.eq("status", "active");
    }

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
    }

    if (unreadOnly) {
      query = query.gt("unread_count", 0);
    }

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: conversations, error } = await query;

    if (error) {
      console.error("Error fetching conversations:", error);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    // Get total unread count
    const { count: totalUnread } = await supabase
      .from("sms_conversations")
      .select("*", { count: "exact", head: true })
      .gt("unread_count", 0);

    return NextResponse.json({
      conversations,
      totalUnread: totalUnread || 0,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

// POST - Create or get conversation for a contact
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json({ error: "contact_id is required" }, { status: 400 });
    }

    // Get the contact
    const { data: contact, error: contactError } = await supabase
      .from("client_contacts")
      .select("id, client_id, phone, mobile, first_name, last_name")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const phoneNumber = contact.mobile || contact.phone;
    if (!phoneNumber) {
      return NextResponse.json({ error: "Contact has no phone number" }, { status: 400 });
    }

    // Check if conversation already exists
    const { data: existingConversation } = await supabase
      .from("sms_conversations")
      .select("*")
      .eq("contact_id", contact_id)
      .single();

    if (existingConversation) {
      return NextResponse.json(existingConversation);
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from("sms_conversations")
      .insert({
        contact_id,
        client_id: contact.client_id,
        phone_number: phoneNumber,
        status: "active",
        is_opted_in: true,
        opted_in_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
