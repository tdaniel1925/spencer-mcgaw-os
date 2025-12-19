/**
 * Privacy Filter Utility
 *
 * Filters data based on user privacy settings and viewer permissions.
 * Used to ensure users only see data they're allowed to access.
 */

import { createClient } from "@/lib/supabase/server";
import type { UserPrivacySettings, PrivacyDataType } from "@/lib/types/permissions";

interface PrivacyContext {
  viewerId: string;
  viewerRole: string;
}

/**
 * Check if a viewer can see a target user's data
 */
export async function canViewUserData(
  viewerId: string,
  targetUserId: string,
  dataType: PrivacyDataType
): Promise<boolean> {
  // Same user can always view their own data
  if (viewerId === targetUserId) return true;

  const supabase = await createClient();

  // Get viewer's role
  const { data: viewer } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", viewerId)
    .single();

  // Admins and owners can always view
  if (viewer?.role === "owner" || viewer?.role === "admin") {
    return true;
  }

  // Check target user's privacy settings
  const { data: privacy } = await supabase
    .from("user_privacy_settings")
    .select("*")
    .eq("user_id", targetUserId)
    .single();

  // If no privacy settings exist, default to visible
  if (!privacy) return true;

  // Check the specific privacy setting
  const privacyField = getPrivacyField(dataType);
  const isHidden = privacy[privacyField as keyof UserPrivacySettings] as boolean;

  // If not hidden, allow access
  if (!isHidden) return true;

  // If hidden, check if viewer is in the allowed list
  const visibleTo = (privacy.visible_to_user_ids as string[]) || [];
  return visibleTo.includes(viewerId);
}

/**
 * Filter an array of tasks based on privacy settings
 */
export async function filterTasksByPrivacy<T extends { assigned_to?: string | null }>(
  tasks: T[],
  viewerId: string
): Promise<T[]> {
  if (tasks.length === 0) return tasks;

  const supabase = await createClient();

  // Get viewer's role
  const { data: viewer } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", viewerId)
    .single();

  // Admins and owners can see all tasks
  if (viewer?.role === "owner" || viewer?.role === "admin") {
    return tasks;
  }

  // Get unique user IDs from tasks
  const userIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[];

  if (userIds.length === 0) return tasks;

  // Get privacy settings for all relevant users
  const { data: privacySettings } = await supabase
    .from("user_privacy_settings")
    .select("*")
    .in("user_id", userIds);

  const privacyMap = new Map(
    (privacySettings || []).map((p) => [p.user_id, p])
  );

  // Filter tasks
  return tasks.filter((task) => {
    // Tasks without assignee are visible
    if (!task.assigned_to) return true;

    // Viewer's own tasks are always visible
    if (task.assigned_to === viewerId) return true;

    // Check privacy settings
    const privacy = privacyMap.get(task.assigned_to);
    if (!privacy) return true; // No privacy settings = visible

    if (!privacy.hide_tasks_from_peers) return true;

    // Check if viewer is in allowed list
    const visibleTo = (privacy.visible_to_user_ids as string[]) || [];
    return visibleTo.includes(viewerId);
  });
}

/**
 * Filter activity logs based on privacy settings
 */
export async function filterActivityByPrivacy<T extends { user_id?: string | null }>(
  activities: T[],
  viewerId: string
): Promise<T[]> {
  if (activities.length === 0) return activities;

  const supabase = await createClient();

  // Get viewer's role
  const { data: viewer } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", viewerId)
    .single();

  // Admins and owners can see all activity
  if (viewer?.role === "owner" || viewer?.role === "admin") {
    return activities;
  }

  // Get unique user IDs from activities
  const userIds = [...new Set(activities.map((a) => a.user_id).filter(Boolean))] as string[];

  if (userIds.length === 0) return activities;

  // Get privacy settings
  const { data: privacySettings } = await supabase
    .from("user_privacy_settings")
    .select("*")
    .in("user_id", userIds);

  const privacyMap = new Map(
    (privacySettings || []).map((p) => [p.user_id, p])
  );

  // Filter activities
  return activities.filter((activity) => {
    if (!activity.user_id) return true;
    if (activity.user_id === viewerId) return true;

    const privacy = privacyMap.get(activity.user_id);
    if (!privacy) return true;

    if (!privacy.hide_activity_from_peers) return true;

    const visibleTo = (privacy.visible_to_user_ids as string[]) || [];
    return visibleTo.includes(viewerId);
  });
}

/**
 * Get user stats with privacy filtering
 * Returns null for stats that are hidden
 */
export async function getUserStatsWithPrivacy(
  targetUserId: string,
  viewerId: string
): Promise<{
  tasks_completed: number | null;
  tasks_in_progress: number | null;
  avg_completion_time: number | null;
  visible: boolean;
}> {
  const supabase = await createClient();

  // Check if viewer can see performance data
  const canView = await canViewUserData(viewerId, targetUserId, "performance");

  if (!canView) {
    return {
      tasks_completed: null,
      tasks_in_progress: null,
      avg_completion_time: null,
      visible: false,
    };
  }

  // Get actual stats
  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("id, created_at, completed_at")
    .eq("assigned_to", targetUserId)
    .eq("status", "completed");

  const { count: inProgressCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", targetUserId)
    .in("status", ["pending", "in_progress", "open"]);

  // Calculate average completion time
  let avgTime = 0;
  if (completedTasks && completedTasks.length > 0) {
    const times = completedTasks
      .filter((t) => t.completed_at && t.created_at)
      .map((t) => {
        const created = new Date(t.created_at!);
        const completed = new Date(t.completed_at!);
        return (completed.getTime() - created.getTime()) / (1000 * 60); // minutes
      });
    avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  return {
    tasks_completed: completedTasks?.length || 0,
    tasks_in_progress: inProgressCount || 0,
    avg_completion_time: Math.round(avgTime),
    visible: true,
  };
}

/**
 * Get the privacy settings field name for a data type
 */
function getPrivacyField(dataType: PrivacyDataType): string {
  const mapping: Record<PrivacyDataType, string> = {
    tasks: "hide_tasks_from_peers",
    activity: "hide_activity_from_peers",
    performance: "hide_performance_from_peers",
    calendar: "hide_calendar_from_peers",
  };
  return mapping[dataType];
}

/**
 * Build a Supabase query filter for privacy-aware task fetching
 * This is more efficient than filtering after fetch for large datasets
 */
export function getPrivacyFilterSQL(viewerId: string, viewerRole: string): string {
  // Admins and owners see everything
  if (viewerRole === "owner" || viewerRole === "admin") {
    return "1=1"; // No filter
  }

  // For other users, either:
  // 1. Task is assigned to them
  // 2. Task is not assigned
  // 3. Assignee hasn't hidden tasks OR viewer is in visible list
  return `
    (
      assigned_to IS NULL
      OR assigned_to = '${viewerId}'
      OR NOT EXISTS (
        SELECT 1 FROM user_privacy_settings ups
        WHERE ups.user_id = tasks.assigned_to
        AND ups.hide_tasks_from_peers = true
        AND NOT ('${viewerId}' = ANY(ups.visible_to_user_ids))
      )
    )
  `;
}
