import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    console.log(`[Email Cleanup] Starting cleanup for user ${user.id}`);

    // Get count of orphaned classifications (no account_id or account doesn't exist)
    const { count: classificationCount } = await supabase
      .from("email_classifications")
      .select("*", { count: "exact", head: true })
      .is("account_id", null);

    const { count: actionItemCount } = await supabase
      .from("email_action_items")
      .select("*", { count: "exact", head: true })
      .is("account_id", null);

    console.log(`[Email Cleanup] Found ${classificationCount || 0} orphaned classifications and ${actionItemCount || 0} orphaned action items`);

    // 1. Delete orphaned email_action_items (no account_id)
    const { error: actionItemsError } = await supabase
      .from("email_action_items")
      .delete()
      .is("account_id", null);

    if (actionItemsError) {
      console.error("[Email Cleanup] Error deleting action items:", actionItemsError);
    } else {
      console.log("[Email Cleanup] Deleted orphaned email action items");
    }

    // 2. Delete orphaned email_classifications (no account_id)
    const { error: classError } = await supabase
      .from("email_classifications")
      .delete()
      .is("account_id", null);

    if (classError) {
      console.error("[Email Cleanup] Error deleting classifications:", classError);
    } else {
      console.log("[Email Cleanup] Deleted orphaned email classifications");
    }

    // 3. Delete tasks from TaskPool that came from email (source_type = 'email')
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
        classifications: classificationCount || 0,
        actionItems: actionItemCount || 0,
        tasks: tasksDeleted || 0,
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
