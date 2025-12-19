import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CreateNotification, NotificationType } from "@/lib/types/permissions";

// GET - Get notifications for current user
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread") === "true";
    const type = searchParams.get("type") as NotificationType | null;

    // Build query
    let query = supabase
      .from("notifications")
      .select(`
        *,
        triggered_by:triggered_by_user_id(id, full_name, avatar_url),
        related_task:related_task_id(id, title),
        related_client:related_client_id(id, first_name, last_name)
      `)
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    if (type) {
      query = query.eq("type", type);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Get counts
    const { count: totalCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_archived", false);

    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .eq("is_archived", false);

    // Transform client names
    const transformedNotifications = (notifications || []).map((n) => ({
      ...n,
      related_client: n.related_client
        ? {
            id: n.related_client.id,
            name: `${n.related_client.first_name} ${n.related_client.last_name}`,
          }
        : null,
    }));

    return NextResponse.json({
      notifications: transformedNotifications,
      total: totalCount || 0,
      unread: unreadCount || 0,
    });
  } catch (error) {
    console.error("Error in GET /api/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a notification (internal use / service calls)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    // Get current user (or service role)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Allow service role or authenticated users to create notifications
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateNotification = await request.json();

    // Validate required fields
    if (!body.user_id || !body.type || !body.title) {
      return NextResponse.json(
        { error: "user_id, type, and title are required" },
        { status: 400 }
      );
    }

    // Create notification
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        user_id: body.user_id,
        type: body.type,
        title: body.title,
        message: body.message || null,
        link: body.link || null,
        related_task_id: body.related_task_id || null,
        related_client_id: body.related_client_id || null,
        triggered_by_user_id: body.triggered_by_user_id || user.id,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
    }

    return NextResponse.json({ notification });
  } catch (error) {
    console.error("Error in POST /api/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Mark notifications as read
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids, mark_all_read } = body;

    if (mark_all_read) {
      // Mark all unread notifications as read
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error("Error marking all as read:", error);
        return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: "all" });
    }

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json(
        { error: "notification_ids array or mark_all_read required" },
        { status: 400 }
      );
    }

    // Mark specific notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .in("id", notification_ids);

    if (error) {
      console.error("Error marking notifications as read:", error);
      return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: notification_ids.length });
  } catch (error) {
    console.error("Error in PATCH /api/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Archive notifications
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("id");
    const archiveAll = searchParams.get("archive_all") === "true";

    if (archiveAll) {
      // Archive all read notifications
      const { error } = await supabase
        .from("notifications")
        .update({ is_archived: true })
        .eq("user_id", user.id)
        .eq("is_read", true);

      if (error) {
        console.error("Error archiving all notifications:", error);
        return NextResponse.json({ error: "Failed to archive notifications" }, { status: 500 });
      }

      return NextResponse.json({ success: true, archived: "all_read" });
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: "id query param or archive_all=true required" },
        { status: 400 }
      );
    }

    // Archive specific notification
    const { error } = await supabase
      .from("notifications")
      .update({ is_archived: true })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error archiving notification:", error);
      return NextResponse.json({ error: "Failed to archive notification" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
