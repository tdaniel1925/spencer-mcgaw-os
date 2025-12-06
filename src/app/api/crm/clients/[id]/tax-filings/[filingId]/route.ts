import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get single tax filing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filingId: string }> }
) {
  const { id: clientId, filingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: filing, error } = await supabase
      .from("client_tax_filings")
      .select("*")
      .eq("id", filingId)
      .eq("client_id", clientId)
      .single();

    if (error) {
      return NextResponse.json({ error: "Filing not found" }, { status: 404 });
    }

    return NextResponse.json(filing);
  } catch (error) {
    console.error("Error fetching filing:", error);
    return NextResponse.json({ error: "Failed to fetch filing" }, { status: 500 });
  }
}

// PUT - Update tax filing
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filingId: string }> }
) {
  const { id: clientId, filingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { data: filing, error } = await supabase
      .from("client_tax_filings")
      .update(body)
      .eq("id", filingId)
      .eq("client_id", clientId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update filing" }, { status: 500 });
    }

    return NextResponse.json(filing);
  } catch (error) {
    console.error("Error updating filing:", error);
    return NextResponse.json({ error: "Failed to update filing" }, { status: 500 });
  }
}

// DELETE - Delete tax filing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filingId: string }> }
) {
  const { id: clientId, filingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("client_tax_filings")
      .delete()
      .eq("id", filingId)
      .eq("client_id", clientId);

    if (error) {
      return NextResponse.json({ error: "Failed to delete filing" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting filing:", error);
    return NextResponse.json({ error: "Failed to delete filing" }, { status: 500 });
  }
}
