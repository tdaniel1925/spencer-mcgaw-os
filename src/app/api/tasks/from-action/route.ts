import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ActionItemPayload {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  type: string;
  sourceType: "phone_call" | "email";
  sourceId: string;
  assignedTo?: string;
  clientId?: string;
  dueDate?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/tasks/from-action
 * Create a task from an action item (from calls or emails)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ActionItemPayload = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Map action type to a task action type
    const actionTypeMapping: Record<string, string> = {
      call_back: "callback",
      callback: "callback",
      send_email: "email",
      email: "email",
      schedule_appointment: "appointment",
      appointment: "appointment",
      document_request: "document",
      document: "document",
      follow_up: "followup",
      followup: "followup",
      review: "review",
      task: "general",
      response: "email",
      calendar: "appointment",
    };

    // Find the action type ID
    const actionTypeCode = actionTypeMapping[body.type] || "general";
    const { data: actionType } = await supabase
      .from("task_action_types")
      .select("id")
      .eq("code", actionTypeCode)
      .single();

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: body.title,
        description: body.description || null,
        priority: body.priority || "medium",
        status: "pending",
        assigned_to: body.assignedTo || null,
        client_id: body.clientId || null,
        action_type_id: actionType?.id || null,
        due_date: body.dueDate || null,
        source_call_id: body.sourceType === "phone_call" ? body.sourceId : null,
        created_by: user.id,
        metadata: {
          source_type: body.sourceType,
          source_id: body.sourceId,
          action_type: body.type,
          created_from_action_item: true,
          ...body.metadata,
        },
      })
      .select("id, title")
      .single();

    if (taskError) {
      console.error("[Create Task from Action] Error:", taskError);
      return NextResponse.json(
        { error: "Failed to create task", details: taskError.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      type: "task_created",
      description: `Task "${task.title}" created from ${body.sourceType.replace("_", " ")}`,
      metadata: {
        taskId: task.id,
        sourceType: body.sourceType,
        sourceId: body.sourceId,
        actionType: body.type,
      },
    });

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
      },
    });
  } catch (error) {
    console.error("[Create Task from Action] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
