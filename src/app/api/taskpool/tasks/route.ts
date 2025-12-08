import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants";

// GET - List tasks with filters
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const actionTypeId = searchParams.get("action_type_id");
  const status = searchParams.get("status");
  const claimedBy = searchParams.get("claimed_by");
  const clientId = searchParams.get("client_id");
  const priority = searchParams.get("priority");
  const view = searchParams.get("view"); // 'pool', 'my_claimed', 'my_clients', 'overdue'

  try {
    let query = supabase
      .from("tasks")
      .select(`
        *,
        action_type:task_action_types!tasks_action_type_id_fkey(id, code, label, color, icon)
      `)
      .order("created_at", { ascending: false });

    // Apply filters based on view
    if (view === "pool") {
      // Pool view: unclaimed AND unassigned, open tasks
      query = query.is("claimed_by", null).is("assigned_to", null).eq("status", "open");
    } else if (view === "my_assigned") {
      // Tasks assigned to current user
      query = query.eq("assigned_to", user.id).neq("status", "completed");
    } else if (view === "my_claimed") {
      // My claimed tasks
      query = query.eq("claimed_by", user.id).neq("status", "completed");
    } else if (view === "my_clients") {
      // Tasks for user's clients (would need client assignment logic)
      // For now, show all tasks the user created
      query = query.eq("created_by", user.id);
    } else if (view === "overdue") {
      // Overdue tasks
      const today = new Date().toISOString().split("T")[0];
      query = query.lt("due_date", today).neq("status", "completed");
    }

    // Additional filters
    if (actionTypeId) {
      query = query.eq("action_type_id", actionTypeId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (claimedBy) {
      query = query.eq("claimed_by", claimedBy);
    }
    if (clientId) {
      query = query.eq("client_id", clientId);
    }
    if (priority) {
      query = query.eq("priority", priority);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error("Error fetching tasks:", error);
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// POST - Create a new task
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      action_type_id,
      client_id,
      priority,
      due_date,
      source_type,
      source_email_id,
      source_metadata,
      ai_confidence,
      ai_extracted_data,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        action_type_id,
        client_id,
        priority: priority || "medium",
        due_date,
        source_type: source_type || "manual",
        source_email_id,
        source_metadata: source_metadata || {},
        ai_confidence,
        ai_extracted_data: ai_extracted_data || {},
        status: "open",
        organization_id: DEFAULT_ORGANIZATION_ID,
        created_by: user.id,
      })
      .select(`
        *,
        action_type:task_action_types!tasks_action_type_id_fkey(id, code, label, color, icon)
      `)
      .single();

    if (error) {
      console.error("Error creating task:", error);
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: task.id,
      action: "created",
      details: { title },
      performed_by: user.id,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
