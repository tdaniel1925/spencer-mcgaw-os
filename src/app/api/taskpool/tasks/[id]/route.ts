import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser, isAdmin, canViewAll } from "@/lib/auth/api-rbac";
import { z } from "zod";

// Validation schema for task updates
const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "on_hold"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  due_date: z.string().datetime().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  action_type_id: z.string().uuid().optional().nullable(),
  next_action_type_id: z.string().uuid().optional().nullable(),
  next_action_date: z.string().datetime().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

// GET - Get single task with all details
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

  try {
    // Verify task exists and user has access (RLS filters by assignment/organization)
    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        action_type:task_action_types!tasks_action_type_id_fkey(*),
        next_action_type:task_action_types!tasks_next_action_type_id_fkey(*),
        client:client_contacts(id, first_name, last_name, email, phone),
        notes:task_notes(*),
        activity:task_activity_log(*),
        attachments:task_attachments(*)
      `)
      .eq("id", id)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

// Helper function to update task with validation and activity logging
async function updateTask(
  id: string,
  body: unknown,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  // Validate request body with Zod
  const parseResult = updateTaskSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      error: { message: "Invalid request data", details: parseResult.error.flatten() },
      status: 400,
    };
  }

  const validatedData = parseResult.data;

  // Verify task exists and user has access
  const { data: currentTask, error: accessError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (accessError || !currentTask) {
    return { error: { message: "Task not found" }, status: 404 };
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .update({
      ...validatedData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      action_type:task_action_types!tasks_action_type_id_fkey(*),
      client:client_contacts(id, first_name, last_name, email, phone)
    `)
    .single();

  if (error) {
    console.error("Error updating task:", error);
    return { error: { message: "Failed to update task" }, status: 500 };
  }

  // Log activity
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(validatedData)) {
    const typedKey = key as keyof typeof validatedData;
    if (currentTask[typedKey] !== validatedData[typedKey]) {
      changes[key] = { from: currentTask[typedKey], to: validatedData[typedKey] };
    }
  }

  if (Object.keys(changes).length > 0) {
    await supabase.from("task_activity_log").insert({
      task_id: id,
      action: "updated",
      details: { changes },
      performed_by: userId,
    });
  }

  return { data: task };
}

// PUT - Update task
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
    const body = await request.json();
    const result = await updateTask(id, body, supabase, user.id);

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message, details: (result.error as { details?: unknown }).details },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// PATCH - Partial update task (uses same logic as PUT)
export async function PATCH(
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
    const body = await request.json();
    const result = await updateTask(id, body, supabase, user.id);

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message, details: (result.error as { details?: unknown }).details },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// DELETE - Delete task (requires admin or task owner)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const apiUser = await getApiUser();

  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    // Verify task exists and check ownership/permissions
    const { data: task, error: accessError } = await supabase
      .from("tasks")
      .select("id, created_by, assigned_to")
      .eq("id", id)
      .single();

    if (accessError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Allow deletion if: admin/owner, task creator, or task assignee
    const isTaskOwner = task.created_by === apiUser.id || task.assigned_to === apiUser.id;
    if (!isAdmin(apiUser) && !isTaskOwner) {
      return NextResponse.json(
        { error: "You can only delete tasks you created or are assigned to" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting task:", error);
      return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
