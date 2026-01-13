import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser, canViewAll } from "@/lib/auth/api-rbac";
import { emailTaskAssigned } from "@/lib/email/email-service";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");
  const limitParam = searchParams.get("limit") || "50";
  const offsetParam = searchParams.get("offset") || "0";
  const unassigned = searchParams.get("unassigned");
  const includeAssignee = searchParams.get("include_assignee") === "true";
  const includeClient = searchParams.get("include_client") === "true";
  const excludeCompletedBefore = searchParams.get("exclude_completed_before");

  // Validate and parse pagination params
  const limitNum = Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200);
  const offsetNum = Math.max(parseInt(offsetParam, 10) || 0, 0);

  // Get authenticated user with role
  const apiUser = await getApiUser();
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = await createClient();

  // Build select query with optional relations
  let selectQuery = "*";
  if (includeClient) {
    selectQuery += ", client:clients(id, first_name, last_name, email, phone)";
  }

  // Skip count query for faster initial load (only need count for pagination)
  const needsCount = offsetNum > 0 || limitNum > 100;

  // Fetch tasks - order by updated_at for better relevance
  let query = supabase
    .from("tasks")
    .select(selectQuery, needsCount ? { count: "exact" } : undefined)
    .order("updated_at", { ascending: false })
    .range(offsetNum, offsetNum + limitNum - 1);

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

  // Performance optimization: exclude old completed tasks from initial load
  // This speeds up dashboard loading significantly
  if (excludeCompletedBefore) {
    // Include all non-completed tasks, plus completed tasks after the cutoff date
    query = query.or(`status.neq.completed,completed_at.gte.${excludeCompletedBefore}`);
  }

  const { data: tasks, error, count } = await query;

  if (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  // If include_assignee is requested, fetch assignee info separately
  interface TaskRecord {
    id: string;
    assigned_to?: string | null;
    claimed_by?: string | null;
    [key: string]: unknown;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tasksWithAssignees: any[] = (tasks as unknown as TaskRecord[]) || [];
  if (includeAssignee && tasks && tasks.length > 0) {
    const taskRecords = tasks as unknown as TaskRecord[];
    // Get unique assignee IDs
    const assigneeIds = [...new Set(
      taskRecords
        .map(t => t.assigned_to || t.claimed_by)
        .filter(Boolean)
    )] as string[];

    if (assigneeIds.length > 0) {
      const { data: assignees } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", assigneeIds);

      const assigneeMap = new Map(
        (assignees || []).map(a => [a.id, a])
      );

      tasksWithAssignees = taskRecords.map(task => ({
        ...task,
        assignee: assigneeMap.get(task.assigned_to || task.claimed_by || "") || null,
      }));
    }
  }

  return NextResponse.json({ tasks: tasksWithAssignees, count });
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

    // Send email notification if task is assigned to someone else
    if (assignee_id && assignee_id !== apiUser.id) {
      emailTaskAssigned(assignee_id, task.id, title, apiUser.email).catch((err) =>
        logger.error("Failed to send task assigned email", err)
      );
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
