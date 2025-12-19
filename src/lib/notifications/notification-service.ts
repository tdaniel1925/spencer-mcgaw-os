/**
 * Notification Service
 *
 * Handles creating notifications for various events in the system.
 * Used by API routes to trigger notifications when tasks change.
 */

import { createClient } from "@/lib/supabase/server";
import type { NotificationType, CreateNotification } from "@/lib/types/permissions";
import {
  emailTaskAssigned,
  emailTaskCompleted,
  emailTaskDueSoon,
  emailTaskOverdue,
} from "@/lib/email/email-service";

interface NotificationRecipient {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  relatedTaskId?: string;
  relatedClientId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for a single user
 */
export async function createNotification(
  notification: CreateNotification
): Promise<void> {
  const supabase = await createClient();

  try {
    // Check user's notification preferences before creating
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", notification.user_id)
      .single();

    // Map notification type to preference field
    const prefKey = getPreferenceKey(notification.type);
    if (prefs && prefKey && !prefs[prefKey]) {
      // User has disabled this notification type
      console.log(`[Notifications] User ${notification.user_id} has disabled ${notification.type}`);
      return;
    }

    // Create the notification
    const { error } = await supabase.from("notifications").insert({
      user_id: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message || null,
      link: notification.link || null,
      related_task_id: notification.related_task_id || null,
      related_client_id: notification.related_client_id || null,
      triggered_by_user_id: notification.triggered_by_user_id || null,
      metadata: notification.metadata || {},
    });

    if (error) {
      console.error("[Notifications] Failed to create notification:", error);
      return;
    }

    console.log(`[Notifications] Created ${notification.type} notification for ${notification.user_id}`);
  } catch (error) {
    console.error("[Notifications] Error creating notification:", error);
  }
}

/**
 * Create notifications for multiple users
 */
export async function createNotifications(
  notifications: CreateNotification[]
): Promise<void> {
  if (notifications.length === 0) return;

  const supabase = await createClient();

  try {
    // Get all user preferences in one query
    const userIds = [...new Set(notifications.map((n) => n.user_id))];
    const { data: allPrefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .in("user_id", userIds);

    const prefsMap = new Map(allPrefs?.map((p) => [p.user_id, p]) || []);

    // Filter notifications based on user preferences
    const filteredNotifications = notifications.filter((n) => {
      const prefs = prefsMap.get(n.user_id);
      const prefKey = getPreferenceKey(n.type);
      return !prefs || !prefKey || prefs[prefKey] !== false;
    });

    if (filteredNotifications.length === 0) {
      console.log("[Notifications] All notifications filtered by user preferences");
      return;
    }

    // Batch insert
    const { error } = await supabase.from("notifications").insert(
      filteredNotifications.map((n) => ({
        user_id: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message || null,
        link: n.link || null,
        related_task_id: n.related_task_id || null,
        related_client_id: n.related_client_id || null,
        triggered_by_user_id: n.triggered_by_user_id || null,
        metadata: n.metadata || {},
      }))
    );

    if (error) {
      console.error("[Notifications] Failed to create batch notifications:", error);
      return;
    }

    console.log(`[Notifications] Created ${filteredNotifications.length} notifications`);
  } catch (error) {
    console.error("[Notifications] Error creating batch notifications:", error);
  }
}

/**
 * Notify user when a task is assigned to them
 */
export async function notifyTaskAssigned(
  taskId: string,
  taskTitle: string,
  assigneeId: string,
  assignedById: string,
  clientId?: string
): Promise<void> {
  // Don't notify if user assigned to themselves
  if (assigneeId === assignedById) return;

  const supabase = await createClient();

  // Get assigner's name for email
  const { data: assigner } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", assignedById)
    .single();

  // Create in-app notification
  await createNotification({
    user_id: assigneeId,
    type: "task_assigned",
    title: "New task assigned to you",
    message: taskTitle,
    link: `/taskpool?task=${taskId}`,
    related_task_id: taskId,
    related_client_id: clientId,
    triggered_by_user_id: assignedById,
  });

  // Send email notification (async, non-blocking)
  emailTaskAssigned(
    assigneeId,
    taskId,
    taskTitle,
    assigner?.full_name || "Someone"
  ).catch((err) => console.error("[Email] Error sending task assigned email:", err));
}

/**
 * Notify task creator when task is completed
 */
export async function notifyTaskCompleted(
  taskId: string,
  taskTitle: string,
  completedById: string,
  creatorId: string,
  assigneeId?: string,
  clientId?: string
): Promise<void> {
  const notifications: CreateNotification[] = [];

  // Notify creator (if different from completer)
  if (creatorId && creatorId !== completedById) {
    notifications.push({
      user_id: creatorId,
      type: "task_completed",
      title: "Task completed",
      message: taskTitle,
      link: `/taskpool?task=${taskId}`,
      related_task_id: taskId,
      related_client_id: clientId,
      triggered_by_user_id: completedById,
    });
  }

  await createNotifications(notifications);
}

/**
 * Notify assignee when task status changes
 */
export async function notifyTaskStatusChanged(
  taskId: string,
  taskTitle: string,
  assigneeId: string,
  changedById: string,
  oldStatus: string,
  newStatus: string,
  clientId?: string
): Promise<void> {
  // Don't notify if user changed their own task
  if (assigneeId === changedById) return;

  await createNotification({
    user_id: assigneeId,
    type: "task_status_changed",
    title: `Task status changed to ${newStatus}`,
    message: taskTitle,
    link: `/taskpool?task=${taskId}`,
    related_task_id: taskId,
    related_client_id: clientId,
    triggered_by_user_id: changedById,
    metadata: { old_status: oldStatus, new_status: newStatus },
  });
}

/**
 * Notify assignee when task is due soon (for scheduled jobs)
 */
export async function notifyTaskDueSoon(
  taskId: string,
  taskTitle: string,
  assigneeId: string,
  dueDate: string,
  clientId?: string
): Promise<void> {
  await createNotification({
    user_id: assigneeId,
    type: "task_due_soon",
    title: "Task due soon",
    message: `"${taskTitle}" is due ${formatDueDate(dueDate)}`,
    link: `/taskpool?task=${taskId}`,
    related_task_id: taskId,
    related_client_id: clientId,
  });
}

/**
 * Notify assignee when task is overdue
 */
export async function notifyTaskOverdue(
  taskId: string,
  taskTitle: string,
  assigneeId: string,
  dueDate: string,
  clientId?: string
): Promise<void> {
  await createNotification({
    user_id: assigneeId,
    type: "task_overdue",
    title: "Task is overdue",
    message: `"${taskTitle}" was due ${formatDueDate(dueDate)}`,
    link: `/taskpool?task=${taskId}`,
    related_task_id: taskId,
    related_client_id: clientId,
    metadata: { due_date: dueDate },
  });
}

/**
 * Notify user when they're mentioned in a comment
 */
export async function notifyMention(
  mentionedUserId: string,
  mentionedById: string,
  context: string,
  link: string,
  taskId?: string,
  clientId?: string
): Promise<void> {
  if (mentionedUserId === mentionedById) return;

  await createNotification({
    user_id: mentionedUserId,
    type: "mention",
    title: "You were mentioned",
    message: context,
    link,
    related_task_id: taskId,
    related_client_id: clientId,
    triggered_by_user_id: mentionedById,
  });
}

/**
 * Create a system alert notification
 */
export async function notifySystemAlert(
  userId: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: "system_alert",
    title,
    message,
    link,
  });
}

/**
 * Notify about AI suggestion
 */
export async function notifyAISuggestion(
  userId: string,
  title: string,
  message: string,
  link?: string,
  taskId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: "ai_suggestion",
    title,
    message,
    link,
    related_task_id: taskId,
    metadata,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map notification type to preference field name
 */
function getPreferenceKey(type: NotificationType): string | null {
  const mapping: Record<NotificationType, string | null> = {
    task_assigned: "inapp_task_assigned",
    task_completed: "inapp_task_completed",
    task_status_changed: "inapp_task_assigned", // Use same as assigned
    task_due_soon: "inapp_task_due_soon",
    task_overdue: "inapp_task_overdue",
    task_comment: "inapp_mentions",
    mention: "inapp_mentions",
    client_activity: "inapp_client_activity",
    system_alert: null, // Always send system alerts
    ai_suggestion: "ai_high_priority_detected",
  };
  return mapping[type];
}

/**
 * Format due date for notification message
 */
function formatDueDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < -1) return `${Math.abs(days)} days ago`;
  if (days > 1) return `in ${days} days`;

  return date.toLocaleDateString();
}
