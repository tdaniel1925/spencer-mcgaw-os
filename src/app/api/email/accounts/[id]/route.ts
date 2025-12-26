import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";

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

    // Count what will be deleted for reporting
    const { count: classificationCount } = await supabase
      .from("email_classifications")
      .select("*", { count: "exact", head: true })
      .eq("account_id", id);

    const { count: actionItemCount } = await supabase
      .from("email_action_items")
      .select("*", { count: "exact", head: true })
      .eq("account_id", id);

    // 1. Delete tasks from TaskPool that came from this account's emails
    const { error: tasksError, count: tasksDeleted } = await supabase
      .from("tasks")
      .delete()
      .eq("source_type", "email")
      .eq("created_by", user.id);

    if (tasksError) {
      logger.error("[Email Cleanup] Error deleting tasks:", tasksError);
    }

    // 2. Delete sender_rules associated with user
    const { error: senderRulesError } = await supabase
      .from("sender_rules")
      .delete()
      .eq("user_id", user.id);

    if (senderRulesError) {
      logger.error("[Email Cleanup] Error deleting sender rules:", senderRulesError);
    }

    // 3. Delete email_training_samples
    const { error: trainingError } = await supabase
      .from("email_training_samples")
      .delete()
      .eq("user_id", user.id);

    if (trainingError) {
      logger.error("[Email Cleanup] Error deleting training samples:", trainingError);
    }

    // 4. Delete email_classifications and email_action_items for this account
    // We need to do this explicitly since existing records may not have account_id set
    const { error: classError } = await supabase
      .from("email_classifications")
      .delete()
      .eq("account_id", id);

    if (classError) {
      logger.error("[Email Cleanup] Error deleting classifications:", classError);
    }

    const { error: actionError } = await supabase
      .from("email_action_items")
      .delete()
      .eq("account_id", id);

    if (actionError) {
      logger.error("[Email Cleanup] Error deleting action items:", actionError);
    }

    // 5. Finally, delete the email_connections record
    const { error: deleteError } = await supabase
      .from("email_connections")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("[Email Cleanup] Error deleting connection:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete email connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email account disconnected and all associated data deleted",
      cleaned: {
        classifications: classificationCount || 0,
        actionItems: actionItemCount || 0,
        tasks: tasksDeleted || 0,
        connection: 1,
      },
    });
  } catch (error) {
    logger.error("[Email Cleanup] Error:", error);
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
    .select("id, provider, email, display_name, expires_at, updated_at, scopes, is_global, description, display_order")
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
    isGlobal: connection.is_global || false,
    description: connection.description || null,
    displayOrder: connection.display_order || 0,
  });
}

/**
 * PUT /api/email/accounts/[id]
 *
 * Update email account settings (display name, global status, etc.)
 * Only owner or admin can update
 */
export async function PUT(
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
    const { displayName, description, isGlobal, displayOrder } = body;

    // Check if user owns the connection or is admin
    const { data: connection, error: connError } = await supabase
      .from("email_connections")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: "Email connection not found" },
        { status: 404 }
      );
    }

    // Check user role if not owner
    let isAdmin = false;
    if (connection.user_id !== user.id) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      isAdmin = profile?.role === "admin";

      if (!isAdmin) {
        return NextResponse.json(
          { error: "Not authorized to update this connection" },
          { status: 403 }
        );
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (displayName !== undefined) updates.display_name = displayName;
    if (description !== undefined) updates.description = description;
    if (displayOrder !== undefined) updates.display_order = displayOrder;

    // Only admins can set global status
    if (isGlobal !== undefined) {
      if (!isAdmin && connection.user_id !== user.id) {
        return NextResponse.json(
          { error: "Only admins can change global status" },
          { status: 403 }
        );
      }

      // Check if user is admin for global changes
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin" && isGlobal === true) {
        return NextResponse.json(
          { error: "Only admins can make accounts global" },
          { status: 403 }
        );
      }

      updates.is_global = isGlobal;
    }

    const { data: updated, error: updateError } = await supabase
      .from("email_connections")
      .update(updates)
      .eq("id", id)
      .select("id, email, display_name, is_global, description, display_order")
      .single();

    if (updateError) {
      logger.error("[Email Account Update] Error:", updateError);
      return NextResponse.json(
        { error: "Failed to update email account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      account: {
        id: updated.id,
        email: updated.email,
        displayName: updated.display_name,
        isGlobal: updated.is_global,
        description: updated.description,
        displayOrder: updated.display_order,
      },
    });
  } catch (error) {
    logger.error("[Email Account Update] Error:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
