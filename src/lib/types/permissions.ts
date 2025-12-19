/**
 * Permission and Privacy Types
 *
 * These types extend the permission system to support:
 * - User-level permission overrides
 * - Granular privacy settings
 * - Department assignments
 */

import { Permission, UserRole } from "@/lib/permissions";

// ============================================================================
// PERMISSION OVERRIDES
// ============================================================================

export interface PermissionOverride {
  id: string;
  user_id: string;
  permission: Permission;
  granted: boolean;
  granted_by: string | null;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePermissionOverride {
  user_id: string;
  permission: Permission;
  granted: boolean;
  reason?: string;
  expires_at?: string;
}

export interface UpdatePermissionOverride {
  granted?: boolean;
  reason?: string;
  expires_at?: string | null;
}

// ============================================================================
// PRIVACY SETTINGS
// ============================================================================

export interface UserPrivacySettings {
  id: string;
  user_id: string;
  hide_tasks_from_peers: boolean;
  hide_activity_from_peers: boolean;
  hide_performance_from_peers: boolean;
  hide_calendar_from_peers: boolean;
  visible_to_user_ids: string[];
  updated_at: string;
}

export interface UpdatePrivacySettings {
  hide_tasks_from_peers?: boolean;
  hide_activity_from_peers?: boolean;
  hide_performance_from_peers?: boolean;
  hide_calendar_from_peers?: boolean;
  visible_to_user_ids?: string[];
}

export type PrivacyDataType = "tasks" | "activity" | "performance" | "calendar";

// ============================================================================
// DEPARTMENTS
// ============================================================================

export interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  manager?: {
    id: string;
    full_name: string;
    email: string;
  };
  member_count?: number;
}

export interface CreateDepartment {
  name: string;
  description?: string;
  manager_id?: string;
}

export interface UpdateDepartment {
  name?: string;
  description?: string;
  manager_id?: string | null;
  is_active?: boolean;
}

export interface UserDepartment {
  id: string;
  user_id: string;
  department_id: string;
  is_primary: boolean;
  joined_at: string;
  // Joined data
  department?: Department;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export type NotificationType =
  | "task_assigned"
  | "task_completed"
  | "task_status_changed"
  | "task_due_soon"
  | "task_overdue"
  | "task_comment"
  | "mention"
  | "client_activity"
  | "system_alert"
  | "ai_suggestion";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  is_archived: boolean;
  related_task_id: string | null;
  related_client_id: string | null;
  triggered_by_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined data
  triggered_by?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  related_task?: {
    id: string;
    title: string;
  };
  related_client?: {
    id: string;
    name: string;
  };
}

export interface CreateNotification {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  related_task_id?: string;
  related_client_id?: string;
  triggered_by_user_id?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  by_type: Record<NotificationType, number>;
}

// ============================================================================
// USER WITH EXTENDED DATA
// ============================================================================

export interface UserWithPermissions {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  department: string | null;
  job_title: string | null;
  is_active: boolean;
  // Extended data
  permission_overrides: PermissionOverride[];
  privacy_settings: UserPrivacySettings | null;
  departments: UserDepartment[];
  effective_permissions: Permission[];
}

// ============================================================================
// REAL-TIME EVENT TYPES
// ============================================================================

export interface TaskRealtimeEvent {
  type: "task_assigned" | "task_completed" | "task_status_changed" | "task_created" | "task_updated";
  task_id: string;
  task: {
    id: string;
    title: string;
    status: string;
    assigned_to: string | null;
    priority: string;
  };
  triggered_by: string;
  timestamp: string;
  affected_user_ids: string[]; // Users who should receive this update
}

export interface NotificationRealtimeEvent {
  type: "new_notification";
  notification: Notification;
}

// ============================================================================
// PERMISSION CHECK CONTEXT
// ============================================================================

export interface PermissionContext {
  userId: string;
  role: UserRole;
  overrides: PermissionOverride[];
}

/**
 * Check if a user has a specific permission considering overrides
 */
export function hasPermissionWithContext(
  context: PermissionContext,
  permission: Permission
): boolean {
  // Check for active override first
  const override = context.overrides.find(
    (o) =>
      o.permission === permission &&
      (!o.expires_at || new Date(o.expires_at) > new Date())
  );

  if (override) {
    return override.granted;
  }

  // Fall back to role-based permission
  // Import from permissions.ts to avoid circular dependency
  const { rolePermissions } = require("@/lib/permissions");
  return rolePermissions[context.role]?.includes(permission) ?? false;
}

/**
 * Get all effective permissions for a user
 */
export function getEffectivePermissions(context: PermissionContext): Permission[] {
  const { rolePermissions } = require("@/lib/permissions");
  const basePermissions = new Set<Permission>(rolePermissions[context.role] || []);

  // Apply overrides
  for (const override of context.overrides) {
    // Skip expired overrides
    if (override.expires_at && new Date(override.expires_at) < new Date()) {
      continue;
    }

    if (override.granted) {
      basePermissions.add(override.permission);
    } else {
      basePermissions.delete(override.permission);
    }
  }

  return Array.from(basePermissions);
}
