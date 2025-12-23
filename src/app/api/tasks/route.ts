import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser, canViewAll } from "@/lib/auth/api-rbac";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");
  const limit = searchParams.get("limit") || "50";
  const offset = searchParams.get("offset") || "0";
  const unassigned = searchParams.get("unassigned");

  // Get authenticated user with role
  const apiUser = await getApiUser();
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("*, client:clients!client_id(id, first_name, last_name, email, phone)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  // RBAC: Staff can only see their assigned, created, or claimed tasks
  if (!canViewAll(apiUser)) {
    query = query.or(`created_by.eq.${apiUser.id},assigned_to.eq.${apiUser.id},claimed_by.eq.${apiUser.id}`);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (priority && priority !== "all") {
    query = query.eq("priority", priority);
  }

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // Filter for unassigned tasks (for Org Tasks Kanban)
  if (unassigned === "true") {
    query = query.is("assigned_to", null);
  }

  const { data: tasks, error, count } = await query;

  if (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  // Tasks now include client as a nested object via the join alias
  return NextResponse.json({ tasks: tasks || [], count });
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
      title,
      description,
      status = "pending",
      priority = "medium",
      due_date,
      client_id,
      client_name,
      assignee_id,
      assignee_name,
      source = "manual",
      source_id,
      tags,
      estimated_minutes,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        status,
        priority,
        due_date,
        client_id,
        client_name,
        assignee_id,
        assignee_name,
        source,
        source_id,
        tags,
        estimated_minutes,
        created_by: apiUser.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating task:", error);
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: apiUser.id,
      user_email: apiUser.email,
      action: "created",
      resource_type: "task",
      resource_id: task.id,
      resource_name: title,
      details: { source, priority },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
