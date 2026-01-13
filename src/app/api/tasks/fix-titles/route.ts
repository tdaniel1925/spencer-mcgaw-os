import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/tasks/fix-titles
 * Fixes tasks that have generic "Manual review required" titles
 * by updating them to use the email subject from source_metadata
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Find tasks with generic titles that have email source metadata
    const { data: tasksToFix, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title, source_metadata, description")
      .eq("source_type", "email")
      .eq("title", "Manual review required");

    if (fetchError) {
      console.error("[Fix Titles] Error fetching tasks:", fetchError);
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    if (!tasksToFix || tasksToFix.length === 0) {
      return NextResponse.json({
        message: "No tasks need fixing",
        fixed: 0
      });
    }

    let fixedCount = 0;
    const errors: string[] = [];

    for (const task of tasksToFix) {
      const metadata = task.source_metadata as {
        email_subject?: string;
        sender_name?: string;
        sender_email?: string;
        classification_summary?: string;
      } | null;

      if (!metadata?.email_subject) {
        errors.push(`Task ${task.id}: No email subject in metadata`);
        continue;
      }

      const newTitle = `Review: ${metadata.email_subject}`;
      const newDescription = metadata.sender_name || metadata.sender_email
        ? `Email from ${metadata.sender_name || ""} <${metadata.sender_email || ""}>\n\n${metadata.classification_summary || "Please review this email."}`
        : task.description;

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          title: newTitle,
          description: newDescription,
        })
        .eq("id", task.id);

      if (updateError) {
        errors.push(`Task ${task.id}: ${updateError.message}`);
      } else {
        fixedCount++;
      }
    }

    return NextResponse.json({
      message: `Fixed ${fixedCount} of ${tasksToFix.length} tasks`,
      fixed: fixedCount,
      total: tasksToFix.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Fix Titles] Error:", error);
    return NextResponse.json({ error: "Failed to fix titles" }, { status: 500 });
  }
}
