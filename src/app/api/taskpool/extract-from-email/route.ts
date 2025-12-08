import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractTasksFromEmail,
  matchClientFromExtraction,
  createTasksFromExtraction,
} from "@/lib/taskpool/ai-extraction";

// POST - Extract tasks from an email using AI
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email_id, email_content, auto_create } = body;

    // Validate input
    if (!email_content || !email_content.subject || !email_content.body) {
      return NextResponse.json(
        { error: "Email content (subject and body) is required" },
        { status: 400 }
      );
    }

    // Get action types
    const { data: actionTypes, error: actionTypesError } = await supabase
      .from("task_action_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (actionTypesError || !actionTypes) {
      console.error("Error fetching action types:", actionTypesError);
      return NextResponse.json(
        { error: "Failed to fetch action types" },
        { status: 500 }
      );
    }

    // Extract tasks using AI
    const extraction = await extractTasksFromEmail(email_content, actionTypes);

    // Match client
    let clientId: string | null = null;
    if (extraction.client_match) {
      clientId = await matchClientFromExtraction(extraction.client_match, supabase);
    }

    // If auto_create is true, create the tasks
    let createdTaskIds: string[] = [];
    if (auto_create && extraction.tasks.length > 0) {
      createdTaskIds = await createTasksFromExtraction(
        extraction,
        email_id || null,
        actionTypes,
        clientId,
        user.id,
        supabase
      );
    }

    return NextResponse.json({
      extraction,
      client_id: clientId,
      created_task_ids: createdTaskIds,
      tasks_count: extraction.tasks.length,
    });
  } catch (error) {
    console.error("Error extracting tasks from email:", error);
    return NextResponse.json(
      { error: "Failed to extract tasks from email" },
      { status: 500 }
    );
  }
}
