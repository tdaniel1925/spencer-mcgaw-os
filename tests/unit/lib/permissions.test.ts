import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessRoute,
  rolePermissions,
  getUserPermissions,
  hasPermissionWithOverrides,
  type UserRole,
  type Permission,
  type PermissionOverride,
} from "@/lib/permissions";

describe("permissions", () => {
  describe("hasPermission", () => {
    it("should return true if owner has any permission", () => {
      expect(hasPermission("owner", "dashboard:view")).toBe(true);
      expect(hasPermission("owner", "system:backup_restore")).toBe(true);
    });

    it("should return true if admin has permission", () => {
      expect(hasPermission("admin", "dashboard:view")).toBe(true);
      expect(hasPermission("admin", "users:manage_roles")).toBe(true);
    });

    it("should return false if admin does not have billing permission", () => {
      expect(hasPermission("admin", "settings:manage_billing")).toBe(false);
    });

    it("should return false for undefined role", () => {
      expect(hasPermission(undefined, "dashboard:view")).toBe(false);
    });

    it("should return true for staff with basic permissions", () => {
      expect(hasPermission("staff", "tasks:view")).toBe(true);
      expect(hasPermission("staff", "tasks:create")).toBe(true);
    });

    it("should return false for staff with admin permissions", () => {
      expect(hasPermission("staff", "users:view")).toBe(false);
      expect(hasPermission("staff", "system:view_audit_logs")).toBe(false);
    });

    it("should return true for viewer with view permissions", () => {
      expect(hasPermission("viewer", "dashboard:view")).toBe(true);
      expect(hasPermission("viewer", "tasks:view")).toBe(true);
    });

    it("should return false for viewer with edit permissions", () => {
      expect(hasPermission("viewer", "tasks:create")).toBe(false);
      expect(hasPermission("viewer", "clients:edit")).toBe(false);
    });

    it("should return true for accountant with financial permissions", () => {
      expect(hasPermission("accountant", "analytics:view_financial")).toBe(true);
      expect(hasPermission("accountant", "clients:view_sensitive")).toBe(true);
    });

    it("should return true for manager with team permissions", () => {
      expect(hasPermission("manager", "tasks:assign")).toBe(true);
      expect(hasPermission("manager", "tasks:view_all")).toBe(true);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if user has any of the permissions", () => {
      expect(hasAnyPermission("staff", ["tasks:view", "users:view"])).toBe(true);
    });

    it("should return false if user has none of the permissions", () => {
      expect(hasAnyPermission("viewer", ["tasks:create", "users:view"])).toBe(false);
    });

    it("should return false for undefined role", () => {
      expect(hasAnyPermission(undefined, ["tasks:view"])).toBe(false);
    });

    it("should return false for empty permissions array", () => {
      expect(hasAnyPermission("owner", [])).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true if user has all permissions", () => {
      expect(hasAllPermissions("owner", ["tasks:view", "users:view", "system:backup_restore"])).toBe(true);
    });

    it("should return false if user is missing any permission", () => {
      expect(hasAllPermissions("staff", ["tasks:view", "users:view"])).toBe(false);
    });

    it("should return false for undefined role", () => {
      expect(hasAllPermissions(undefined, ["tasks:view"])).toBe(false);
    });

    it("should return true for empty permissions array", () => {
      expect(hasAllPermissions("viewer", [])).toBe(true);
    });
  });

  describe("canAccessRoute", () => {
    it("should return true for dashboard with view permission", () => {
      expect(canAccessRoute("viewer", "/dashboard")).toBe(true);
    });

    it("should return false for admin pages without permission", () => {
      expect(canAccessRoute("viewer", "/admin/users")).toBe(false);
    });

    it("should return true for owner accessing any route", () => {
      expect(canAccessRoute("owner", "/admin/users")).toBe(true);
      expect(canAccessRoute("owner", "/admin/system")).toBe(true);
    });

    it("should return true for undefined routes (no restriction)", () => {
      expect(canAccessRoute("viewer", "/some-undefined-route")).toBe(true);
    });

    it("should return false for undefined role", () => {
      expect(canAccessRoute(undefined, "/dashboard")).toBe(false);
    });

    it("should return true for admin accessing user management", () => {
      expect(canAccessRoute("admin", "/admin/users")).toBe(true);
    });

    it("should return false for staff accessing admin routes", () => {
      expect(canAccessRoute("staff", "/admin/users")).toBe(false);
    });
  });

  describe("rolePermissions", () => {
    it("should have owner with all permissions", () => {
      expect(rolePermissions.owner.length).toBeGreaterThanOrEqual(50);
    });

    it("should have viewer with minimum permissions", () => {
      expect(rolePermissions.viewer.length).toBeLessThan(20);
    });

    it("should have ascending permission count from viewer to owner", () => {
      expect(rolePermissions.viewer.length).toBeLessThan(rolePermissions.staff.length);
      expect(rolePermissions.staff.length).toBeLessThan(rolePermissions.manager.length);
      expect(rolePermissions.admin.length).toBeLessThan(rolePermissions.owner.length);
    });
  });

  describe("getUserPermissions", () => {
    it("should return base permissions for role", () => {
      const permissions = getUserPermissions("viewer");
      expect(permissions).toContain("dashboard:view");
      expect(permissions).not.toContain("users:view");
    });

    it("should add granted overrides", () => {
      const overrides: PermissionOverride[] = [
        {
          id: "1",
          user_id: "user1",
          permission: "users:view",
          granted: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      const permissions = getUserPermissions("viewer", overrides);
      expect(permissions).toContain("users:view");
    });

    it("should remove revoked overrides", () => {
      const overrides: PermissionOverride[] = [
        {
          id: "1",
          user_id: "user1",
          permission: "dashboard:view",
          granted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      const permissions = getUserPermissions("viewer", overrides);
      expect(permissions).not.toContain("dashboard:view");
    });

    it("should ignore expired overrides", () => {
      const overrides: PermissionOverride[] = [
        {
          id: "1",
          user_id: "user1",
          permission: "users:view",
          granted: true,
          expires_at: new Date(Date.now() - 86400000).toISOString(), // Expired yesterday
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      const permissions = getUserPermissions("viewer", overrides);
      expect(permissions).not.toContain("users:view");
    });

    it("should return empty array for undefined role", () => {
      expect(getUserPermissions(undefined)).toEqual([]);
    });
  });

  describe("hasPermissionWithOverrides", () => {
    it("should return override value when present", () => {
      const overrides: PermissionOverride[] = [
        {
          id: "1",
          user_id: "user1",
          permission: "users:view",
          granted: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      expect(hasPermissionWithOverrides("viewer", "users:view", overrides)).toBe(true);
    });

    it("should fall back to role permission when no override", () => {
      expect(hasPermissionWithOverrides("viewer", "dashboard:view", [])).toBe(true);
      expect(hasPermissionWithOverrides("viewer", "users:view", [])).toBe(false);
    });

    it("should fall back to role permission when override is expired", () => {
      const overrides: PermissionOverride[] = [
        {
          id: "1",
          user_id: "user1",
          permission: "users:view",
          granted: true,
          expires_at: new Date(Date.now() - 86400000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      expect(hasPermissionWithOverrides("viewer", "users:view", overrides)).toBe(false);
    });
  });
});
