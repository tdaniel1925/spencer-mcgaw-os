// Comprehensive Permission System for Spencer McGaw Hub

// User Roles - hierarchical from highest to lowest
export type UserRole = "owner" | "admin" | "manager" | "accountant" | "staff" | "viewer";

// Feature Permissions - granular access control
export type Permission =
  // Dashboard
  | "dashboard:view"
  | "dashboard:view_analytics"
  | "dashboard:view_revenue"
  // Tasks
  | "tasks:view"
  | "tasks:create"
  | "tasks:edit"
  | "tasks:delete"
  | "tasks:assign"
  | "tasks:view_all" // View all users' tasks
  // Clients
  | "clients:view"
  | "clients:create"
  | "clients:edit"
  | "clients:delete"
  | "clients:view_sensitive" // SSN, EIN, financial data
  | "clients:export"
  // Calls/Phone Agent
  | "calls:view"
  | "calls:make"
  | "calls:view_recordings"
  | "calls:manage_agent"
  // Email
  | "email:view"
  | "email:send"
  | "email:manage_rules"
  | "email:connect_accounts"
  // Documents
  | "documents:view"
  | "documents:upload"
  | "documents:download"
  | "documents:delete"
  | "documents:manage_rules"
  | "documents:view_all_clients"
  // Analytics
  | "analytics:view"
  | "analytics:view_financial"
  | "analytics:export"
  // Calendar
  | "calendar:view"
  | "calendar:create"
  | "calendar:edit"
  | "calendar:view_all" // View all team calendars
  // Activity Log
  | "activity:view"
  | "activity:view_all"
  // Settings
  | "settings:view"
  | "settings:edit_profile"
  | "settings:manage_integrations"
  | "settings:manage_billing"
  // User Management (Admin)
  | "users:view"
  | "users:create"
  | "users:edit"
  | "users:delete"
  | "users:manage_roles"
  // System Administration
  | "system:view_audit_logs"
  | "system:manage_api_keys"
  | "system:backup_restore";

// Role-based permission definitions
export const rolePermissions: Record<UserRole, Permission[]> = {
  owner: [
    // All permissions
    "dashboard:view", "dashboard:view_analytics", "dashboard:view_revenue",
    "tasks:view", "tasks:create", "tasks:edit", "tasks:delete", "tasks:assign", "tasks:view_all",
    "clients:view", "clients:create", "clients:edit", "clients:delete", "clients:view_sensitive", "clients:export",
    "calls:view", "calls:make", "calls:view_recordings", "calls:manage_agent",
    "email:view", "email:send", "email:manage_rules", "email:connect_accounts",
    "documents:view", "documents:upload", "documents:download", "documents:delete", "documents:manage_rules", "documents:view_all_clients",
    "analytics:view", "analytics:view_financial", "analytics:export",
    "calendar:view", "calendar:create", "calendar:edit", "calendar:view_all",
    "activity:view", "activity:view_all",
    "settings:view", "settings:edit_profile", "settings:manage_integrations", "settings:manage_billing",
    "users:view", "users:create", "users:edit", "users:delete", "users:manage_roles",
    "system:view_audit_logs", "system:manage_api_keys", "system:backup_restore",
  ],
  admin: [
    // Almost all permissions except billing and system restore
    "dashboard:view", "dashboard:view_analytics", "dashboard:view_revenue",
    "tasks:view", "tasks:create", "tasks:edit", "tasks:delete", "tasks:assign", "tasks:view_all",
    "clients:view", "clients:create", "clients:edit", "clients:delete", "clients:view_sensitive", "clients:export",
    "calls:view", "calls:make", "calls:view_recordings", "calls:manage_agent",
    "email:view", "email:send", "email:manage_rules", "email:connect_accounts",
    "documents:view", "documents:upload", "documents:download", "documents:delete", "documents:manage_rules", "documents:view_all_clients",
    "analytics:view", "analytics:view_financial", "analytics:export",
    "calendar:view", "calendar:create", "calendar:edit", "calendar:view_all",
    "activity:view", "activity:view_all",
    "settings:view", "settings:edit_profile", "settings:manage_integrations",
    "users:view", "users:create", "users:edit", "users:delete", "users:manage_roles",
    "system:view_audit_logs", "system:manage_api_keys",
  ],
  manager: [
    // Department management level
    "dashboard:view", "dashboard:view_analytics",
    "tasks:view", "tasks:create", "tasks:edit", "tasks:delete", "tasks:assign", "tasks:view_all",
    "clients:view", "clients:create", "clients:edit", "clients:view_sensitive", "clients:export",
    "calls:view", "calls:make", "calls:view_recordings",
    "email:view", "email:send", "email:manage_rules",
    "documents:view", "documents:upload", "documents:download", "documents:delete", "documents:view_all_clients",
    "analytics:view", "analytics:view_financial",
    "calendar:view", "calendar:create", "calendar:edit", "calendar:view_all",
    "activity:view", "activity:view_all",
    "settings:view", "settings:edit_profile",
    "users:view",
  ],
  accountant: [
    // Financial-focused permissions
    "dashboard:view", "dashboard:view_analytics", "dashboard:view_revenue",
    "tasks:view", "tasks:create", "tasks:edit",
    "clients:view", "clients:edit", "clients:view_sensitive",
    "calls:view",
    "email:view", "email:send",
    "documents:view", "documents:upload", "documents:download", "documents:view_all_clients",
    "analytics:view", "analytics:view_financial", "analytics:export",
    "calendar:view", "calendar:create", "calendar:edit",
    "activity:view",
    "settings:view", "settings:edit_profile",
  ],
  staff: [
    // Regular staff member
    "dashboard:view",
    "tasks:view", "tasks:create", "tasks:edit",
    "clients:view", "clients:create", "clients:edit",
    "calls:view", "calls:make",
    "email:view", "email:send",
    "documents:view", "documents:upload", "documents:download",
    "calendar:view", "calendar:create", "calendar:edit",
    "activity:view",
    "settings:view", "settings:edit_profile",
  ],
  viewer: [
    // Read-only access
    "dashboard:view",
    "tasks:view",
    "clients:view",
    "calls:view",
    "email:view",
    "documents:view",
    "calendar:view",
    "activity:view",
    "settings:view",
  ],
};

// Navigation item visibility based on permissions
export interface NavPermission {
  href: string;
  requiredPermissions: Permission[];
  requireAll?: boolean; // If true, user needs ALL permissions; if false, ANY permission
}

export const navPermissions: NavPermission[] = [
  { href: "/dashboard", requiredPermissions: ["dashboard:view"] },
  { href: "/tasks", requiredPermissions: ["tasks:view"] },
  { href: "/clients", requiredPermissions: ["clients:view"] },
  { href: "/clients/new", requiredPermissions: ["clients:create"] },
  { href: "/calls", requiredPermissions: ["calls:view"] },
  { href: "/calls/agent", requiredPermissions: ["calls:manage_agent"] },
  { href: "/email", requiredPermissions: ["email:view"] },
  { href: "/documents", requiredPermissions: ["documents:view"] },
  { href: "/analytics", requiredPermissions: ["analytics:view"] },
  { href: "/calendar", requiredPermissions: ["calendar:view"] },
  { href: "/activity", requiredPermissions: ["activity:view"] },
  { href: "/settings", requiredPermissions: ["settings:view"] },
  { href: "/admin/users", requiredPermissions: ["users:view"] },
  { href: "/admin/system", requiredPermissions: ["system:view_audit_logs"] },
];

// Helper functions
export function hasPermission(userRole: UserRole | undefined, permission: Permission): boolean {
  if (!userRole) return false;
  return rolePermissions[userRole]?.includes(permission) ?? false;
}

export function hasAnyPermission(userRole: UserRole | undefined, permissions: Permission[]): boolean {
  if (!userRole) return false;
  return permissions.some((p) => hasPermission(userRole, p));
}

export function hasAllPermissions(userRole: UserRole | undefined, permissions: Permission[]): boolean {
  if (!userRole) return false;
  return permissions.every((p) => hasPermission(userRole, p));
}

export function canAccessRoute(userRole: UserRole | undefined, href: string): boolean {
  if (!userRole) return false;

  const navPerm = navPermissions.find((np) => href.startsWith(np.href));
  if (!navPerm) return true; // No restriction defined

  if (navPerm.requireAll) {
    return hasAllPermissions(userRole, navPerm.requiredPermissions);
  }
  return hasAnyPermission(userRole, navPerm.requiredPermissions);
}

// Role display names and descriptions
export const roleInfo: Record<UserRole, { name: string; description: string; color: string }> = {
  owner: {
    name: "Owner",
    description: "Full system access with billing and system administration",
    color: "bg-purple-500",
  },
  admin: {
    name: "Administrator",
    description: "Full access to manage users, settings, and all features",
    color: "bg-red-500",
  },
  manager: {
    name: "Manager",
    description: "Team management, client oversight, and reporting access",
    color: "bg-orange-500",
  },
  accountant: {
    name: "Accountant",
    description: "Financial data access, client documents, and reporting",
    color: "bg-blue-500",
  },
  staff: {
    name: "Staff",
    description: "Standard access to tasks, clients, and daily operations",
    color: "bg-green-500",
  },
  viewer: {
    name: "Viewer",
    description: "Read-only access to view information without editing",
    color: "bg-gray-500",
  },
};

// Permission categories for UI display
export const permissionCategories = {
  dashboard: {
    name: "Dashboard",
    permissions: ["dashboard:view", "dashboard:view_analytics", "dashboard:view_revenue"] as Permission[],
  },
  tasks: {
    name: "Tasks",
    permissions: ["tasks:view", "tasks:create", "tasks:edit", "tasks:delete", "tasks:assign", "tasks:view_all"] as Permission[],
  },
  clients: {
    name: "Clients",
    permissions: ["clients:view", "clients:create", "clients:edit", "clients:delete", "clients:view_sensitive", "clients:export"] as Permission[],
  },
  calls: {
    name: "Calls & Phone Agent",
    permissions: ["calls:view", "calls:make", "calls:view_recordings", "calls:manage_agent"] as Permission[],
  },
  email: {
    name: "Email",
    permissions: ["email:view", "email:send", "email:manage_rules", "email:connect_accounts"] as Permission[],
  },
  documents: {
    name: "Documents",
    permissions: ["documents:view", "documents:upload", "documents:download", "documents:delete", "documents:manage_rules", "documents:view_all_clients"] as Permission[],
  },
  analytics: {
    name: "Analytics",
    permissions: ["analytics:view", "analytics:view_financial", "analytics:export"] as Permission[],
  },
  calendar: {
    name: "Calendar",
    permissions: ["calendar:view", "calendar:create", "calendar:edit", "calendar:view_all"] as Permission[],
  },
  activity: {
    name: "Activity Log",
    permissions: ["activity:view", "activity:view_all"] as Permission[],
  },
  settings: {
    name: "Settings",
    permissions: ["settings:view", "settings:edit_profile", "settings:manage_integrations", "settings:manage_billing"] as Permission[],
  },
  users: {
    name: "User Management",
    permissions: ["users:view", "users:create", "users:edit", "users:delete", "users:manage_roles"] as Permission[],
  },
  system: {
    name: "System Administration",
    permissions: ["system:view_audit_logs", "system:manage_api_keys", "system:backup_restore"] as Permission[],
  },
};

// Permission override type for custom per-user permissions
export interface PermissionOverride {
  id: string;
  user_id: string;
  permission: Permission;
  granted: boolean;
  granted_by?: string;
  reason?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// Check if a permission is granted with overrides considered
export function hasPermissionWithOverrides(
  userRole: UserRole | undefined,
  permission: Permission,
  overrides: PermissionOverride[] = []
): boolean {
  // Check for explicit override first
  const override = overrides.find(o => o.permission === permission);
  if (override) {
    // Check if override is expired
    if (override.expires_at && new Date(override.expires_at) < new Date()) {
      // Override expired, fall back to role-based permission
    } else {
      return override.granted;
    }
  }

  // Fall back to role-based permission
  return hasPermission(userRole, permission);
}

// Get all permissions for a user including overrides
export function getUserPermissions(
  userRole: UserRole | undefined,
  overrides: PermissionOverride[] = []
): Permission[] {
  if (!userRole) return [];

  const basePermissions = new Set(rolePermissions[userRole] || []);

  // Apply overrides
  for (const override of overrides) {
    // Check if override is expired
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

// Human-readable permission names
export const permissionNames: Record<Permission, string> = {
  "dashboard:view": "View Dashboard",
  "dashboard:view_analytics": "View Analytics",
  "dashboard:view_revenue": "View Revenue Data",
  "tasks:view": "View Tasks",
  "tasks:create": "Create Tasks",
  "tasks:edit": "Edit Tasks",
  "tasks:delete": "Delete Tasks",
  "tasks:assign": "Assign Tasks",
  "tasks:view_all": "View All Users' Tasks",
  "clients:view": "View Clients",
  "clients:create": "Create Clients",
  "clients:edit": "Edit Clients",
  "clients:delete": "Delete Clients",
  "clients:view_sensitive": "View Sensitive Data (SSN, EIN)",
  "clients:export": "Export Client Data",
  "calls:view": "View Calls",
  "calls:make": "Make Calls",
  "calls:view_recordings": "View Call Recordings",
  "calls:manage_agent": "Manage AI Phone Agent",
  "email:view": "View Emails",
  "email:send": "Send Emails",
  "email:manage_rules": "Manage Email Rules",
  "email:connect_accounts": "Connect Email Accounts",
  "documents:view": "View Documents",
  "documents:upload": "Upload Documents",
  "documents:download": "Download Documents",
  "documents:delete": "Delete Documents",
  "documents:manage_rules": "Manage Document Rules",
  "documents:view_all_clients": "View All Clients' Documents",
  "analytics:view": "View Analytics",
  "analytics:view_financial": "View Financial Reports",
  "analytics:export": "Export Analytics",
  "calendar:view": "View Calendar",
  "calendar:create": "Create Events",
  "calendar:edit": "Edit Events",
  "calendar:view_all": "View All Calendars",
  "activity:view": "View Activity Log",
  "activity:view_all": "View All Activity",
  "settings:view": "View Settings",
  "settings:edit_profile": "Edit Profile",
  "settings:manage_integrations": "Manage Integrations",
  "settings:manage_billing": "Manage Billing",
  "users:view": "View Users",
  "users:create": "Create Users",
  "users:edit": "Edit Users",
  "users:delete": "Delete Users",
  "users:manage_roles": "Manage User Roles",
  "system:view_audit_logs": "View Audit Logs",
  "system:manage_api_keys": "Manage API Keys",
  "system:backup_restore": "Backup & Restore",
};
