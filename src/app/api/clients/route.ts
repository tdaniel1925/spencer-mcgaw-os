import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser, canViewAll } from "@/lib/auth/api-rbac";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const limit = searchParams.get("limit") || "100";
  const offset = searchParams.get("offset") || "0";

  // Get authenticated user with role
  const apiUser = await getApiUser();
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .order("name", { ascending: true })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  // RBAC: Staff can only see clients they created
  if (!canViewAll(apiUser)) {
    query = query.eq("created_by", apiUser.id);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: clients, error, count } = await query;

  if (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }

  return NextResponse.json({ clients, count });
}

export async function POST(request: NextRequest) {
  // Get authenticated user with role
  const apiUser = await getApiUser();
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      status = "active",
      notes,
      tags,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        name,
        email,
        phone,
        address,
        city,
        state,
        zip,
        status,
        notes,
        tags,
        created_by: apiUser.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating client:", error);
      return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: apiUser.id,
      user_email: apiUser.email,
      action: "created",
      resource_type: "client",
      resource_id: client.id,
      resource_name: client.name,
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
