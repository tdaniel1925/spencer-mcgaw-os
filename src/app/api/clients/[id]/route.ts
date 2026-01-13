import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser, isAdmin } from "@/lib/auth/api-rbac";
import { z } from "zod";

// Validation schema for client updates
const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  status: z.enum(["active", "inactive", "prospect", "archived"]).optional(),
  notes: z.string().max(10000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
}).strict();

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

  // Verify client exists and user has access (RLS filters by organization)
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ client });
}

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
    // Verify client exists and user has access (RLS filters by organization)
    const { data: existingClient, error: accessError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", id)
      .single();

    if (accessError || !existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Validate request body with Zod
    const body = await request.json();
    const parseResult = updateClientSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;
    const updateData = {
      ...validatedData,
      updated_at: new Date().toISOString(),
    };

    const { data: client, error } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating client:", error);
      return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "updated",
      resource_type: "client",
      resource_id: client.id,
      resource_name: client.name,
      details: { updated_fields: Object.keys(validatedData) },
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Require admin privileges for client deletion
  const apiUser = await getApiUser();
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isAdmin(apiUser)) {
    return NextResponse.json({ error: "Admin privileges required to delete clients" }, { status: 403 });
  }

  const supabase = await createClient();

  // Verify client exists and user has access (RLS filters by organization)
  const { data: client, error: accessError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", id)
    .single();

  if (accessError || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
  }

  // Log activity
  await supabase.from("activity_log").insert({
    user_id: apiUser.id,
    user_email: apiUser.email,
    action: "deleted",
    resource_type: "client",
    resource_id: id,
    resource_name: client.name || "Unknown",
  });

  return NextResponse.json({ success: true });
}
