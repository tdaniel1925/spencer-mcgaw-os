import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  errorResponse,
  handleApiError,
  parseBody,
  ErrorCodes,
} from "@/lib/api-utils";
import logger from "@/lib/logger";
import { emailTaskAssigned, emailTaskCompleted } from "@/lib/email/email-service";

// Validation schemas
const taskUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  due_date: z.string().datetime().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
}).strict();

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = paramsSchema.parse(await params);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", ErrorCodes.UNAUTHORIZED, 401);
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !task) {
      return errorResponse("Task not found", ErrorCodes.NOT_FOUND, 404);
    }

    return successResponse({ task });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = paramsSchema.parse(await params);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", ErrorCodes.UNAUTHORIZED, 401);
    }

    const body = await parseBody(request, taskUpdateSchema);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "completed") {
        updates.completed_at = new Date().toISOString();
      }
    }
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.due_date !== undefined) updates.due_date = body.due_date;
    if (body.client_id !== undefined) updates.client_id = body.client_id;

    // Map assignee_id to assigned_to (database column name)
    const assigneeValue = body.assigned_to ?? body.assignee_id;
    if (assigneeValue !== undefined) {
      updates.assigned_to = assigneeValue;
      if (assigneeValue) {
        updates.assigned_at = new Date().toISOString();
        updates.assigned_by = user.id;
      } else {
        updates.assigned_at = null;
        updates.assigned_by = null;
      }
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update task", error, { taskId: id });
      return errorResponse("Failed to update task", ErrorCodes.DATABASE_ERROR, 500);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: body.status === "completed" ? "completed" : "updated",
      resource_type: "task",
      resource_id: id,
      resource_name: task.title,
      details: { changes: Object.keys(updates).filter(k => k !== "updated_at") },
    });

    // Send email notifications (non-blocking)
    const assigneeId = task.assigned_to;
    const assignerName = user.user_metadata?.full_name || user.email || "Someone";

    // Notify assignee when task is assigned to them
    if (assigneeValue && assigneeValue !== user.id) {
      emailTaskAssigned(assigneeValue, id, task.title, assignerName).catch((err) =>
        logger.error("Failed to send task assigned email", err)
      );
    }

    // Notify task creator/assigner when task is completed
    if (body.status === "completed" && task.created_by && task.created_by !== user.id) {
      const completerName = user.user_metadata?.full_name || user.email || "Someone";
      emailTaskCompleted(task.created_by, id, task.title, completerName).catch((err) =>
        logger.error("Failed to send task completed email", err)
      );
    }

    return successResponse({ task, success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH is an alias for PUT
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = paramsSchema.parse(await params);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", ErrorCodes.UNAUTHORIZED, 401);
    }

    // Get task details for logging
    const { data: task } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Failed to delete task", error, { taskId: id });
      return errorResponse("Failed to delete task", ErrorCodes.DATABASE_ERROR, 500);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "deleted",
      resource_type: "task",
      resource_id: id,
      resource_name: task?.title || "Unknown task",
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
