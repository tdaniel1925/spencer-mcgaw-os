import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
    // Get the classification
    const { data: classification, error: classError } = await supabase
      .from("email_classifications")
      .select("*")
      .eq("id", id)
      .single();

    if (classError || !classification) {
      return NextResponse.json({ error: "Classification not found" }, { status: 404 });
    }

    // Get action items for this email
    const { data: actionItems } = await supabase
      .from("email_action_items")
      .select("*")
      .eq("email_message_id", classification.email_message_id)
      .eq("status", "pending");

    // Create tasks from action items
    const createdTasks = [];
    for (const item of actionItems || []) {
      // Map priority
      const priorityMap: Record<string, string> = {
        urgent: "high",
        high: "high",
        medium: "medium",
        low: "low",
      };

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: item.title,
          description: item.description || `Created from email: ${classification.summary}`,
          priority: priorityMap[item.priority] || "medium",
          status: "todo",
          due_date: item.mentioned_date,
          assigned_to: classification.suggested_assignee_id || user.id,
          created_by: user.id,
          // Link to email
          metadata: {
            source: "email_intelligence",
            email_message_id: classification.email_message_id,
            classification_id: classification.id,
            action_item_id: item.id,
          },
        })
        .select()
        .single();

      if (!taskError && task) {
        createdTasks.push(task);

        // Update action item status
        await supabase
          .from("email_action_items")
          .update({
            status: "approved",
            created_task_id: task.id,
            completed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }
    }

    // Log user action for learning
    await supabase.from("email_user_actions").insert({
      user_id: user.id,
      email_message_id: classification.email_message_id,
      ai_category: classification.category,
      ai_priority: classification.priority_score >= 60 ? "high" : "medium",
      action_type: "approve",
      action_value: JSON.stringify({ created_tasks: createdTasks.length }),
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      tasksCreated: createdTasks.length,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Error approving intelligence:", error);
    return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
  }
}
