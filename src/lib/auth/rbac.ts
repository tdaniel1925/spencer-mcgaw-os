// Role-based access control utilities

export type UserRole = "admin" | "manager" | "staff";

// Define permissions for each role
export const rolePermissions: Record<UserRole, string[]> = {
  admin: [
    "manage:users",
    "manage:clients",
    "manage:tasks",
    "manage:settings",
    "view:all",
    "delete:any",
    "export:data",
    "view:audit-logs",
    "manage:vapi",
  ],
  manager: [
    "manage:clients",
    "manage:tasks",
    "view:all",
    "delete:own",
    "export:data",
    "view:audit-logs",
  ],
  staff: [
    "view:assigned-clients",
    "manage:own-tasks",
    "view:own",
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: string): boolean {
  return rolePermissions[role]?.includes(permission) || false;
}

// Check if a role can access a specific resource
export function canAccess(role: UserRole, resource: string, action: string): boolean {
  const permission = `${action}:${resource}`;
  const allPermission = `${action}:all`;

  return (
    rolePermissions[role]?.includes(permission) ||
    rolePermissions[role]?.includes(allPermission) ||
    false
  );
}

// Navigation items with role-based visibility
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: UserRole[]; // If undefined, visible to all roles
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "Home" },
  { label: "Tasks", href: "/tasks", icon: "CheckSquare" },
  { label: "Clients", href: "/clients", icon: "Users" },
  { label: "Calendar", href: "/calendar", icon: "Calendar" },
  { label: "Calls", href: "/calls", icon: "Phone" },
  { label: "Activity", href: "/activity", icon: "Activity", roles: ["admin", "manager"] },
  { label: "Settings", href: "/settings", icon: "Settings", roles: ["admin"] },
];

// Get navigation items visible to a specific role
export function getVisibleNavItems(role: UserRole): NavItem[] {
  return navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });
}
