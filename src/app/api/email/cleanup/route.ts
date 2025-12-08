import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/email/cleanup
 *
 * Cleans up all orphaned email data when no email account is connected.
 * This is used when a user has disconnected their email but data remains.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    console.log(`[Email Cleanup] Starting cleanup for user ${user.id}`);

    // Get all email classifications (we need the IDs for cleanup)
    const { data: classifications } = await supabase
      .from("email_classifications")
      .select("id, email_message_id");

    const emailMessageIds = (classifications || []).map(c => c.email_message_id);
    const classificationIds = (classifications || []).map(c => c.id);

    console.log(`[Email Cleanup] Found ${emailMessageIds.length} email classifications to delete`);

    // 1. Delete email_action_items for these emails
    if (emailMessageIds.length > 0) {
      const { error: actionItemsError } = await supabase
        .from("email_action_items")
        .delete()
        .in("email_message_id", emailMessageIds);

      if (actionItemsError) {
        console.error("[Email Cleanup] Error deleting action items:", actionItemsError);
      } else {
        console.log("[Email Cleanup] Deleted email action items");
      }
    }

    // 2. Delete tasks from TaskPool that came from email (source_type = 'email')
    const { error: tasksError, count: tasksDeleted } = await supabase
      .from("tasks")
      .delete()
      .eq("source_type", "email")
      .eq("created_by", user.id);

    if (tasksError) {
      console.error("[Email Cleanup] Error deleting tasks:", tasksError);
    } else {
      console.log(`[Email Cleanup] Deleted ${tasksDeleted || 0} tasks from TaskPool`);
    }

    // 3. Delete email_classifications
    if (classificationIds.length > 0) {
      const { error: classError } = await supabase
        .from("email_classifications")
        .delete()
        .in("id", classificationIds);

      if (classError) {
        console.error("[Email Cleanup] Error deleting classifications:", classError);
      } else {
        console.log("[Email Cleanup] Deleted email classifications");
      }
    }

    // 4. Delete sender_rules associated with user
    const { error: senderRulesError } = await supabase
      .from("sender_rules")
      .delete()
      .eq("user_id", user.id);

    if (senderRulesError) {
      console.error("[Email Cleanup] Error deleting sender rules:", senderRulesError);
    }

    // 5. Delete email_training_samples
    const { error: trainingError } = await supabase
      .from("email_training_samples")
      .delete()
      .eq("user_id", user.id);

    if (trainingError) {
      console.error("[Email Cleanup] Error deleting training samples:", trainingError);
    }

    console.log(`[Email Cleanup] Successfully cleaned up all orphaned data for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: "All orphaned email data has been deleted",
      cleaned: {
        classifications: classificationIds.length,
        emailMessageIds: emailMessageIds.length,
        tasksDeleted: tasksDeleted || 0,
      },
    });
  } catch (error) {
    console.error("[Email Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup email data" },
      { status: 500 }
    );
  }
}
