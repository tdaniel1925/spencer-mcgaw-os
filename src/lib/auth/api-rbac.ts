import { createClient } from "@/lib/supabase/server";
import { UserRole, hasPermission } from "./rbac";

export interface ApiUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Get the current authenticated user with their role from the database.
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

  return {
    id: user.id,
    email: user.email || "",
    role: (profile?.role as UserRole) || "staff",
  };
}

/**
 * Check if the user has a specific permission.
 */
export function userHasPermission(user: ApiUser, permission: string): boolean {
  return hasPermission(user.role, permission);
}

/**
 * Check if the user is an admin or manager (can view all resources).
 */
export function canViewAll(user: ApiUser): boolean {
  return user.role === "admin" || user.role === "manager";
}

/**
 * Check if the user is an admin.
 */
export function isAdmin(user: ApiUser): boolean {
  return user.role === "admin";
}
