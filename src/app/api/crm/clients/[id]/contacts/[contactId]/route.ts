import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get single contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: clientId, contactId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: contact, error } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("id", contactId)
      .eq("client_id", clientId)
      .single();

    if (error) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    return NextResponse.json({ error: "Failed to fetch contact" }, { status: 500 });
  }
}

// PUT - Update contact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: clientId, contactId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // If setting as primary, unset other primary contacts first
    if (body.is_primary) {
      await supabase
        .from("client_contacts")
        .update({ is_primary: false })
        .eq("client_id", clientId)
        .neq("id", contactId);
    }

    const { data: contact, error } = await supabase
      .from("client_contacts")
      .update(body)
      .eq("id", contactId)
      .eq("client_id", clientId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}

// DELETE - Delete contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: clientId, contactId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("client_contacts")
      .delete()
      .eq("id", contactId)
      .eq("client_id", clientId);

    if (error) {
      return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}
