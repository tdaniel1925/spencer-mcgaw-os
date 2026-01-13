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

    // Note: Tasks created from emails are preserved (not deleted)
    // The user may have assigned or worked on these tasks

    // 1. Delete email_sender_rules created by this user
    const { error: senderRulesError } = await supabase
      .from("email_sender_rules")
      .delete()
      .eq("created_by", user.id);

    if (senderRulesError) {
      logger.error("[Email Cleanup] Error deleting sender rules:", senderRulesError);
    }

    // 2. Delete email_training_feedback for this user (AI training data)
    const { error: trainingError } = await supabase
      .from("email_training_feedback")
      .delete()
      .eq("created_by", user.id);

    if (trainingError) {
      logger.error("[Email Cleanup] Error deleting training feedback:", trainingError);
    }

    // 3. Delete email_classifications and email_action_items for this account
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

    // 4. Finally, delete the email_connections record
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
      message: "Email account disconnected and associated data deleted (tasks preserved)",
      cleaned: {
        classifications: classificationCount || 0,
        actionItems: actionItemCount || 0,
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

    // Users can set global status on their OWN accounts (personal inbox vs org feed routing)
    // This allows users to choose where their emails appear
    if (isGlobal !== undefined) {
      // User must own the account to change routing, or be an admin
      if (connection.user_id !== user.id && !isAdmin) {
        return NextResponse.json(
          { error: "Not authorized to change routing for this account" },
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
