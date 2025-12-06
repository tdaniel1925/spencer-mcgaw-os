import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List contacts for a client
export async function GET(
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
    const { data: contacts, error } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("last_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

// POST - Create a new contact
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
      first_name,
      last_name,
      title,
      email,
      phone,
      mobile,
      is_primary,
      is_authorized_signer,
      receives_tax_docs,
      receives_invoices,
      birthday,
      notes,
    } = body;

    // If this is being set as primary, unset other primaries first
    if (is_primary) {
      await supabase
        .from("client_contacts")
        .update({ is_primary: false })
        .eq("client_id", clientId);
    }

    const { data: contact, error } = await supabase
      .from("client_contacts")
      .insert({
        client_id: clientId,
        first_name,
        last_name,
        title,
        email,
        phone,
        mobile,
        is_primary: is_primary || false,
        is_authorized_signer: is_authorized_signer || false,
        receives_tax_docs: receives_tax_docs ?? true,
        receives_invoices: receives_invoices || false,
        birthday,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    // If this is the first contact, set it as primary on the client
    if (is_primary) {
      await supabase
        .from("clients")
        .update({ primary_contact_id: contact.id })
        .eq("id", clientId);
    }

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
