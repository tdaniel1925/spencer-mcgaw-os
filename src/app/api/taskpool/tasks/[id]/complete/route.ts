import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Complete a task and optionally route to next action
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
    const body = await request.json();
    const { route_to_action_type_id, route_title, route_description } = body;

    // Get current task
    const { data: currentTask } = await supabase
      .from("tasks")
      .select("*, action_type:task_action_types!tasks_action_type_id_fkey(*)")
      .eq("id", id)
      .single();

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Complete the task
    const { data: completedTask, error: completeError } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (completeError) {
      console.error("Error completing task:", completeError);
      return NextResponse.json({ error: "Failed to complete task" }, { status: 500 });
    }

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: id,
      action: "completed",
      details: { completed_by: user.id },
      performed_by: user.id,
    });

    // If routing to next action type, create a new task
    let newTask = null;
    if (route_to_action_type_id) {
      const { data: routedTask, error: routeError } = await supabase
        .from("tasks")
        .insert({
          title: route_title || `Follow-up: ${currentTask.title}`,
          description: route_description || currentTask.description,
          action_type_id: route_to_action_type_id,
          client_id: currentTask.client_id,
          priority: currentTask.priority,
          due_date: currentTask.due_date,
          source_type: "routed",
          source_metadata: { routed_from_task_id: id },
          routed_from_task_id: id,
          status: "open",
          organization_id: currentTask.organization_id,
          created_by: user.id,
        })
        .select(`
          *,
          action_type:task_action_types!tasks_action_type_id_fkey(*),
          client:client_contacts(id, first_name, last_name, company)
        `)
        .single();

      if (routeError) {
        console.error("Error routing task:", routeError);
        // Don't fail the whole operation, just log the error
      } else {
        newTask = routedTask;

        // Log routing activity
        await supabase.from("task_activity_log").insert({
          task_id: id,
          action: "routed",
          details: {
            new_task_id: routedTask.id,
            action_type_id: route_to_action_type_id,
          },
          performed_by: user.id,
        });

        // Log creation on new task
        await supabase.from("task_activity_log").insert({
          task_id: routedTask.id,
          action: "created",
          details: {
            routed_from_task_id: id,
            title: routedTask.title,
          },
          performed_by: user.id,
        });
      }
    }

    return NextResponse.json({
      completedTask,
      routedTask: newTask,
    });
  } catch (error) {
    console.error("Error completing task:", error);
    return NextResponse.json({ error: "Failed to complete task" }, { status: 500 });
  }
}
