import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/email/accounts/[id]
 *
 * Disconnects an email account and cleans up ALL associated data:
 * - email_classifications
 * - email_action_items
 * - tasks (from TaskPool where source_type = 'email')
 * - email_connections
 */
export async function DELETE(
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
    // Verify the connection belongs to this user
    const { data: connection, error: connError } = await supabase
      .from("email_connections")
      .select("id, user_id, email")
      .eq("id", id)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: "Email connection not found" },
        { status: 404 }
      );
    }

    if (connection.user_id !== user.id) {
      return NextResponse.json(
        { error: "Not authorized to delete this connection" },
        { status: 403 }
      );
    }

    console.log(`[Email Cleanup] Starting cleanup for connection ${id} (${connection.email})`);

    // Get all email message IDs from classifications for this user
    // We need these to clean up action items
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

    // 3. Delete task_activity_log entries for deleted tasks
    // Note: This may cascade automatically depending on FK constraints

    // 4. Delete email_classifications
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

    // 5. Delete sender_rules associated with user
    const { error: senderRulesError } = await supabase
      .from("sender_rules")
      .delete()
      .eq("user_id", user.id);

    if (senderRulesError) {
      console.error("[Email Cleanup] Error deleting sender rules:", senderRulesError);
    }

    // 6. Delete email_training_samples
    const { error: trainingError } = await supabase
      .from("email_training_samples")
      .delete()
      .eq("user_id", user.id);

    if (trainingError) {
      console.error("[Email Cleanup] Error deleting training samples:", trainingError);
    }

    // 7. Finally, delete the email_connections record
    const { error: deleteError } = await supabase
      .from("email_connections")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[Email Cleanup] Error deleting connection:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete email connection" },
        { status: 500 }
      );
    }

    console.log(`[Email Cleanup] Successfully cleaned up all data for connection ${id}`);

    return NextResponse.json({
      success: true,
      message: "Email account disconnected and all associated data deleted",
      cleaned: {
        classifications: classificationIds.length,
        emailMessageIds: emailMessageIds.length,
        connection: 1,
      },
    });
  } catch (error) {
    console.error("[Email Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect email account" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/email/accounts/[id]
 *
 * Get details for a specific email account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: connection, error } = await supabase
    .from("email_connections")
    .select("id, provider, email, display_name, expires_at, updated_at, scopes")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !connection) {
    return NextResponse.json(
      { error: "Email connection not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: connection.id,
    email: connection.email,
    displayName: connection.display_name || connection.email,
    provider: connection.provider,
    isConnected: new Date(connection.expires_at) > new Date(),
    lastSyncAt: connection.updated_at ? new Date(connection.updated_at) : null,
  });
}
