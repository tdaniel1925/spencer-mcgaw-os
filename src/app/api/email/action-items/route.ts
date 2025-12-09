/**
 * Email Action Items API
 *
 * Manage action items extracted from emails
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ActionItem {
  id: string;
  emailMessageId: string;
  title: string;
  description?: string;
  actionType: string;
  mentionedDate?: string;
  mentionedAmount?: number;
  mentionedDocumentType?: string;
  mentionedClientName?: string;
  status: "pending" | "in_progress" | "completed" | "dismissed";
  priority: "low" | "medium" | "high" | "urgent";
  assignedToUserId?: string;
  assignedToUserName?: string;
  createdTaskId?: string;
  linkedClientId?: string;
  linkedClientName?: string;
  confidence: number;
  extractionMethod?: string;
  createdAt: string;
  completedAt?: string;
}

// Get action items
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const emailMessageId = searchParams.get("emailMessageId");
    const status = searchParams.get("status");
    const assignedTo = searchParams.get("assignedTo");
    const priority = searchParams.get("priority");
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = supabase
      .from("email_action_items")
      .select(`
        id,
        email_message_id,
        title,
        description,
        action_type,
        mentioned_date,
        mentioned_amount,
        mentioned_document_type,
        mentioned_client_name,
        status,
        priority,
        assigned_to_user_id,
        created_task_id,
        linked_client_id,
        confidence,
        extraction_method,
        created_at,
        completed_at
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (emailMessageId) {
      query = query.eq("email_message_id", emailMessageId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (assignedTo) {
      query = query.eq("assigned_to_user_id", assignedTo);
    }
    if (priority) {
      query = query.eq("priority", priority);
    }

    const { data: items, error } = await query;

    if (error) {
      throw error;
    }

    // Get user names and client names
    const userIds = [...new Set(items?.map((i) => i.assigned_to_user_id).filter(Boolean))];
    const clientIds = [...new Set(items?.map((i) => i.linked_client_id).filter(Boolean))];

    const [usersResult, clientsResult] = await Promise.all([
      userIds.length > 0
        ? supabase.from("user_profiles").select("id, full_name").in("id", userIds)
        : { data: [] },
      clientIds.length > 0
        ? supabase.from("clients").select("id, first_name, last_name").in("id", clientIds)
        : { data: [] },
    ]);

    const userMap = new Map(usersResult.data?.map((u) => [u.id, u.full_name]) || []);
    const clientMap = new Map(
      clientsResult.data?.map((c) => [c.id, `${c.first_name} ${c.last_name}`]) || []
    );

    const formattedItems: ActionItem[] = (items || []).map((item) => ({
      id: item.id,
      emailMessageId: item.email_message_id,
      title: item.title,
      description: item.description,
      actionType: item.action_type,
      mentionedDate: item.mentioned_date,
      mentionedAmount: item.mentioned_amount,
      mentionedDocumentType: item.mentioned_document_type,
      mentionedClientName: item.mentioned_client_name,
      status: item.status,
      priority: item.priority,
      assignedToUserId: item.assigned_to_user_id,
      assignedToUserName: userMap.get(item.assigned_to_user_id),
      createdTaskId: item.created_task_id,
      linkedClientId: item.linked_client_id,
      linkedClientName: clientMap.get(item.linked_client_id),
      confidence: item.confidence,
      extractionMethod: item.extraction_method,
      createdAt: item.created_at,
      completedAt: item.completed_at,
    }));

    return NextResponse.json({
      success: true,
      actionItems: formattedItems,
      count: formattedItems.length,
    });
  } catch (error) {
    console.error("[Action Items API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch action items" },
      { status: 500 }
    );
  }
}

// Update action item status
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      id,
      status,
      assignedToUserId,
      priority,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Action item ID required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      updateData.status = status;
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }
    }
    if (assignedToUserId !== undefined) {
      updateData.assigned_to_user_id = assignedToUserId;
    }
    if (priority !== undefined) {
      updateData.priority = priority;
    }

    const { error } = await supabase
      .from("email_action_items")
      .update(updateData)
      .eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Action Items API] Error updating:", error);
    return NextResponse.json(
      { error: "Failed to update action item" },
      { status: 500 }
    );
  }
}

// Create task from action item
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { actionItemId } = body;

    if (!actionItemId) {
      return NextResponse.json(
        { error: "Action item ID required" },
        { status: 400 }
      );
    }

    // Get action item
    const { data: actionItem, error: itemError } = await supabase
      .from("email_action_items")
      .select("*")
      .eq("id", actionItemId)
      .single();

    if (itemError || !actionItem) {
      return NextResponse.json(
        { error: "Action item not found" },
        { status: 404 }
      );
    }

    // Create task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: actionItem.title,
        description: actionItem.description || `From email action item`,
        status: "pending",
        priority: actionItem.priority || "medium",
        due_date: actionItem.mentioned_date,
        client_id: actionItem.linked_client_id,
        source: "email",
        source_id: actionItem.email_message_id,
        created_by: user.id,
        assignee_id: actionItem.assigned_to_user_id,
      })
      .select()
      .single();

    if (taskError) {
      throw taskError;
    }

    // Update action item with task reference
    await supabase
      .from("email_action_items")
      .update({
        created_task_id: task.id,
        status: "in_progress",
      })
      .eq("id", actionItemId);

    return NextResponse.json({
      success: true,
      taskId: task.id,
    });
  } catch (error) {
    console.error("[Action Items API] Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

// Delete/dismiss action item
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const dismiss = searchParams.get("dismiss") === "true";

    if (!id) {
      return NextResponse.json(
        { error: "Action item ID required" },
        { status: 400 }
      );
    }

    if (dismiss) {
      // Soft delete - mark as dismissed
      await supabase
        .from("email_action_items")
        .update({ status: "dismissed" })
        .eq("id", id);
    } else {
      // Hard delete
      await supabase
        .from("email_action_items")
        .delete()
        .eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Action Items API] Error deleting:", error);
    return NextResponse.json(
      { error: "Failed to delete action item" },
      { status: 500 }
    );
  }
}
