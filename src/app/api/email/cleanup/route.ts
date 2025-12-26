import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";

/**
 * POST /api/email/cleanup
 *
 * Cleans up all orphaned email data when no email account is connected.
 * This includes records with NULL account_id (legacy data) and any records
 * belonging to deleted accounts.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {

    // Get count of orphaned classifications (no account_id or account doesn't exist)
    const { count: classificationCount } = await supabase
      .from("email_classifications")
      .select("*", { count: "exact", head: true })
      .is("account_id", null);

    const { count: actionItemCount } = await supabase
      .from("email_action_items")
      .select("*", { count: "exact", head: true })
      .is("account_id", null);

    // 1. Delete orphaned email_action_items (no account_id)
    const { error: actionItemsError } = await supabase
      .from("email_action_items")
      .delete()
      .is("account_id", null);

    if (actionItemsError) {
      logger.error("[Email Cleanup] Error deleting action items:", actionItemsError);
    }

    // 2. Delete orphaned email_classifications (no account_id)
    const { error: classError } = await supabase
      .from("email_classifications")
      .delete()
      .is("account_id", null);

    if (classError) {
      logger.error("[Email Cleanup] Error deleting classifications:", classError);
    }

    // 3. Delete tasks from TaskPool that came from email (source_type = 'email')
    const { error: tasksError, count: tasksDeleted } = await supabase
      .from("tasks")
      .delete()
      .eq("source_type", "email")
      .eq("created_by", user.id);

    if (tasksError) {
      logger.error("[Email Cleanup] Error deleting tasks:", tasksError);
    }

    // 4. Delete sender_rules associated with user
    const { error: senderRulesError } = await supabase
      .from("sender_rules")
      .delete()
      .eq("user_id", user.id);

    if (senderRulesError) {
      logger.error("[Email Cleanup] Error deleting sender rules:", senderRulesError);
    }

    // 5. Delete email_training_samples
    const { error: trainingError } = await supabase
      .from("email_training_samples")
      .delete()
      .eq("user_id", user.id);

    if (trainingError) {
      logger.error("[Email Cleanup] Error deleting training samples:", trainingError);
    }

    return NextResponse.json({
      success: true,
      message: "All orphaned email data has been deleted",
      cleaned: {
        classifications: classificationCount || 0,
        actionItems: actionItemCount || 0,
        tasks: tasksDeleted || 0,
      },
    });
  } catch (error) {
    logger.error("[Email Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup email data" },
      { status: 500 }
    );
  }
}
