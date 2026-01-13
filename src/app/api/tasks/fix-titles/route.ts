import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/tasks/fix-titles
 * Fixes tasks that have generic "Manual review required" titles
 * by updating them with proper titles and full email content
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Find ALL email-sourced tasks that might need fixing
    // (either have generic title or missing email body in description)
    const { data: tasksToFix, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title, source_metadata, source_email_id, description")
      .eq("source_type", "email");

    if (fetchError) {
      console.error("[Fix Titles] Error fetching tasks:", fetchError);
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    if (!tasksToFix || tasksToFix.length === 0) {
      return NextResponse.json({
        message: "No email tasks found",
        fixed: 0
      });
    }

    // Get all email classifications for these tasks
    const emailIds = tasksToFix
      .map(t => t.source_email_id)
      .filter(Boolean);

    const { data: emails } = await supabase
      .from("email_classifications")
      .select("email_message_id, subject, summary, body_text, body_preview, sender_name, sender_email")
      .in("email_message_id", emailIds);

    // Create lookup map
    const emailMap = new Map(
      (emails || []).map(e => [e.email_message_id, e])
    );

    let fixedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const task of tasksToFix) {
      const metadata = task.source_metadata as {
        email_subject?: string;
        sender_name?: string;
        sender_email?: string;
        classification_summary?: string;
      } | null;

      const email = emailMap.get(task.source_email_id);

      // Determine the best title
      const emailSubject = email?.subject || metadata?.email_subject;
      const needsTitleFix = task.title === "Manual review required" || task.title === "Review email";

      // Determine if description needs fixing (doesn't have full email body)
      const hasEmailBody = task.description?.includes("--- Email Content ---");
      const needsDescriptionFix = !hasEmailBody && (email?.body_text || email?.body_preview);

      if (!needsTitleFix && !needsDescriptionFix) {
        skippedCount++;
        continue;
      }

      // Build new title
      const newTitle = needsTitleFix && emailSubject
        ? `Review: ${emailSubject}`
        : task.title;

      // Build comprehensive description with email content
      const senderName = email?.sender_name || metadata?.sender_name || "Unknown";
      const senderEmail = email?.sender_email || metadata?.sender_email || "";
      const summary = email?.summary || metadata?.classification_summary || "";
      const emailBody = email?.body_text || email?.body_preview || "";

      let newDescription = `**From:** ${senderName} <${senderEmail}>\n`;
      newDescription += `**Subject:** ${emailSubject || "(No Subject)"}\n\n`;

      if (summary) {
        newDescription += `**Summary:**\n${summary}\n\n`;
      }

      if (emailBody) {
        newDescription += `--- Email Content ---\n\n${emailBody}`;
      }

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
      message: `Fixed ${fixedCount} tasks, skipped ${skippedCount} (already complete)`,
      fixed: fixedCount,
      skipped: skippedCount,
      total: tasksToFix.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Fix Titles] Error:", error);
    return NextResponse.json({ error: "Failed to fix titles" }, { status: 500 });
  }
}
