import { createClient } from "@/lib/supabase/server";
import {
  UserRole,
  Permission,
  hasPermissionWithOverrides,
  PermissionOverride,
} from "@/lib/permissions";

export interface ApiUser {
  id: string;
  email: string;
  role: UserRole;
  permissionOverrides: PermissionOverride[];
}

/**
 * Get the current authenticated user with their role and permission overrides from the database.
 * Returns null if not authenticated.
 */
export async function getApiUser(): Promise<ApiUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user role from profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Get permission overrides
  const { data: overrides } = await supabase
    .from("user_permission_overrides")
    .select("*")
    .eq("user_id", user.id);

  // Filter out expired overrides
  const activeOverrides = (overrides || []).filter(
    o => !o.expires_at || new Date(o.expires_at) > new Date()
  );

  return {
    id: user.id,
    email: user.email || "",
    role: (profile?.role as UserRole) || "staff",
    permissionOverrides: activeOverrides,
  };
}

/**
 * Check if the user has a specific permission (with overrides).
 */
export function userHasPermission(user: ApiUser, permission: Permission): boolean {
  return hasPermissionWithOverrides(user.role, permission, user.permissionOverrides);
}

/**
 * Check if the user is an admin or manager (can view all resources).
 */
export function canViewAll(user: ApiUser): boolean {
  return user.role === "admin" || user.role === "manager" || user.role === "owner";
}

/**
 * Check if the user is an admin or owner.
 */
export function isAdmin(user: ApiUser): boolean {
  return user.role === "admin" || user.role === "owner";
}

/**
 * Check if the user is an owner.
 */
export function isOwner(user: ApiUser): boolean {
  return user.role === "owner";
}
