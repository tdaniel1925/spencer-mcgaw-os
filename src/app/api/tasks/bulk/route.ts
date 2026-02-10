/**
 * Bulk Task Operations API
 * POST /api/tasks/bulk
 *
 * Performs bulk operations on multiple tasks (delete, assign, status change).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logBulkOperation, extractBulkRequestMetadata } from "@/lib/audit/bulk-operations";
import logger from "@/lib/logger";
import { z } from "zod";

const BulkTaskOperationSchema = z.object({
  operation: z.enum(["delete", "assign", "status_change", "priority_change"]),
  taskIds: z.array(z.string().uuid()).min(1).max(100),
  // Operation-specific fields
  assignedTo: z.string().uuid().optional(), // For assign operation
  status: z.enum(["open", "in_progress", "waiting", "completed", "cancelled"]).optional(), // For status_change
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(), // For priority_change
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validated = BulkTaskOperationSchema.parse(body);

    let successCount = 0;
    let failedIds: string[] = [];

    // Perform the bulk operation
    switch (validated.operation) {
      case "delete":
        for (const taskId of validated.taskIds) {
          const { error } = await supabase.from("tasks").delete().eq("id", taskId);
          if (error) {
            failedIds.push(taskId);
            logger.error("[Bulk Tasks] Failed to delete task", { taskId, error });
          } else {
            successCount++;
          }
        }

        // Log bulk operation
        await logBulkOperation({
          userId: user.id,
          userEmail: user.email,
          operation: "bulk_delete",
          resourceType: "task",
          resourceIds: validated.taskIds,
          details: {
            successCount,
            failedCount: failedIds.length,
            failedIds,
          },
          ...extractBulkRequestMetadata(request),
        });
        break;

      case "assign":
        if (!validated.assignedTo) {
          return NextResponse.json({ error: "assignedTo required for assign operation" }, { status: 400 });
        }

        // Get assignee details
        const { data: assignee } = await supabase
          .from("user_profiles")
          .select("full_name, email")
          .eq("id", validated.assignedTo)
          .single();

        for (const taskId of validated.taskIds) {
          const { error } = await supabase
            .from("tasks")
            .update({
              assigned_to: validated.assignedTo,
              assigned_at: new Date().toISOString(),
              assigned_by: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", taskId);

          if (error) {
            failedIds.push(taskId);
            logger.error("[Bulk Tasks] Failed to assign task", { taskId, error });
          } else {
            successCount++;
          }
        }

        // Log bulk operation
        await logBulkOperation({
          userId: user.id,
          userEmail: user.email,
          operation: "bulk_assign",
          resourceType: "task",
          resourceIds: validated.taskIds,
          details: {
            assignedToId: validated.assignedTo,
            assignedToName: assignee?.full_name || assignee?.email,
            successCount,
            failedCount: failedIds.length,
            failedIds,
          },
          ...extractBulkRequestMetadata(request),
        });
        break;

      case "status_change":
        if (!validated.status) {
          return NextResponse.json({ error: "status required for status_change operation" }, { status: 400 });
        }

        const updates: Record<string, any> = {
          status: validated.status,
          updated_at: new Date().toISOString(),
        };

        if (validated.status === "completed") {
          updates.completed_at = new Date().toISOString();
        }

        for (const taskId of validated.taskIds) {
          const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);

          if (error) {
            failedIds.push(taskId);
            logger.error("[Bulk Tasks] Failed to change task status", { taskId, error });
          } else {
            successCount++;
          }
        }

        // Log bulk operation
        await logBulkOperation({
          userId: user.id,
          userEmail: user.email,
          operation: "bulk_status_change",
          resourceType: "task",
          resourceIds: validated.taskIds,
          details: {
            newStatus: validated.status,
            successCount,
            failedCount: failedIds.length,
            failedIds,
          },
          ...extractBulkRequestMetadata(request),
        });
        break;

      case "priority_change":
        if (!validated.priority) {
          return NextResponse.json({ error: "priority required for priority_change operation" }, { status: 400 });
        }

        for (const taskId of validated.taskIds) {
          const { error } = await supabase
            .from("tasks")
            .update({
              priority: validated.priority,
              updated_at: new Date().toISOString(),
            })
            .eq("id", taskId);

          if (error) {
            failedIds.push(taskId);
            logger.error("[Bulk Tasks] Failed to change task priority", { taskId, error });
          } else {
            successCount++;
          }
        }

        // Log bulk operation
        await logBulkOperation({
          userId: user.id,
          userEmail: user.email,
          operation: "bulk_update",
          resourceType: "task",
          resourceIds: validated.taskIds,
          details: {
            field: "priority",
            newPriority: validated.priority,
            successCount,
            failedCount: failedIds.length,
            failedIds,
          },
          ...extractBulkRequestMetadata(request),
        });
        break;
    }

    const duration = Date.now() - startTime;

    logger.info("[Bulk Tasks] Bulk operation completed", {
      operation: validated.operation,
      totalRequested: validated.taskIds.length,
      successCount,
      failedCount: failedIds.length,
      duration,
    });

    return NextResponse.json({
      success: true,
      operation: validated.operation,
      totalRequested: validated.taskIds.length,
      successCount,
      failedCount: failedIds.length,
      failedIds: failedIds.length > 0 ? failedIds : undefined,
      duration,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    logger.error("[Bulk Tasks] Bulk operation failed", { error });

    return NextResponse.json(
      {
        error: "Bulk operation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
