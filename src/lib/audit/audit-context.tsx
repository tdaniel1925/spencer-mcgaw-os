"use client";

import { createContext, useContext, useCallback, useRef, useEffect } from "react";
import {
  AuditLogEntry,
  AuditCategory,
  AuditAction,
  AuditSeverity,
  AuditStatus,
  AuditResource,
  AuditChange,
  UserAgentInfo,
} from "./types";
import { useAuth } from "@/lib/supabase/auth-context";

// Generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Parse user agent string
function parseUserAgent(ua: string): UserAgentInfo {
  const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);

  let browser = "Unknown";
  let browserVersion = "";
  let os = "Unknown";
  let osVersion = "";
  let device = isMobile ? "Mobile" : "Desktop";

  // Browser detection
  if (ua.includes("Chrome") && !ua.includes("Edg")) {
    browser = "Chrome";
    const match = ua.match(/Chrome\/(\d+\.\d+)/);
    browserVersion = match?.[1] || "";
  } else if (ua.includes("Firefox")) {
    browser = "Firefox";
    const match = ua.match(/Firefox\/(\d+\.\d+)/);
    browserVersion = match?.[1] || "";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    browser = "Safari";
    const match = ua.match(/Version\/(\d+\.\d+)/);
    browserVersion = match?.[1] || "";
  } else if (ua.includes("Edg")) {
    browser = "Edge";
    const match = ua.match(/Edg\/(\d+\.\d+)/);
    browserVersion = match?.[1] || "";
  }

  // OS detection
  if (ua.includes("Windows")) {
    os = "Windows";
    if (ua.includes("Windows NT 10.0")) osVersion = "10/11";
    else if (ua.includes("Windows NT 6.3")) osVersion = "8.1";
    else if (ua.includes("Windows NT 6.2")) osVersion = "8";
  } else if (ua.includes("Mac OS X")) {
    os = "macOS";
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    osVersion = match?.[1]?.replace("_", ".") || "";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
    const match = ua.match(/Android (\d+\.\d+)/);
    osVersion = match?.[1] || "";
  } else if (ua.includes("iPhone") || ua.includes("iPad")) {
    os = "iOS";
    const match = ua.match(/OS (\d+_\d+)/);
    osVersion = match?.[1]?.replace("_", ".") || "";
  }

  return { browser, browserVersion, os, osVersion, device, isMobile };
}

// Get severity based on action type
function getSeverityForAction(action: AuditAction, status: AuditStatus): AuditSeverity {
  // Critical actions
  const criticalActions: AuditAction[] = [
    "user_delete",
    "client_delete",
    "backup_restore",
    "security_alert",
    "suspicious_activity",
  ];

  // Warning actions
  const warningActions: AuditAction[] = [
    "login_failed",
    "permission_denied",
    "ip_blocked",
    "user_deactivate",
    "api_key_revoke",
    "password_reset_request",
  ];

  if (status === "failure") {
    return criticalActions.includes(action) ? "critical" : "warning";
  }

  if (criticalActions.includes(action)) return "critical";
  if (warningActions.includes(action)) return "warning";

  return "info";
}

// Action descriptions
const actionDescriptions: Record<AuditAction, string> = {
  // Authentication
  login: "User logged in",
  logout: "User logged out",
  login_failed: "Failed login attempt",
  password_change: "Password changed",
  password_reset_request: "Password reset requested",
  password_reset_complete: "Password reset completed",
  session_expired: "Session expired",
  mfa_enabled: "Two-factor authentication enabled",
  mfa_disabled: "Two-factor authentication disabled",
  mfa_verified: "Two-factor authentication verified",
  // Client
  client_view: "Viewed client details",
  client_create: "Created new client",
  client_update: "Updated client information",
  client_delete: "Deleted client",
  client_archive: "Archived client",
  client_restore: "Restored client",
  client_note_add: "Added client note",
  client_note_edit: "Edited client note",
  client_note_delete: "Deleted client note",
  client_assign: "Assigned client to user",
  client_unassign: "Unassigned client from user",
  client_export: "Exported client data",
  // Document
  document_view: "Viewed document",
  document_upload: "Uploaded document",
  document_download: "Downloaded document",
  document_delete: "Deleted document",
  document_share: "Shared document",
  document_assign: "Assigned document to client",
  document_unassign: "Unassigned document from client",
  document_analyze: "Analyzed document with AI",
  // Task
  task_view: "Viewed task details",
  task_create: "Created new task",
  task_update: "Updated task",
  task_delete: "Deleted task",
  task_complete: "Completed task",
  task_reopen: "Reopened task",
  task_assign: "Assigned task to user",
  task_unassign: "Unassigned task from user",
  task_comment: "Added comment to task",
  // Email
  email_view: "Viewed email",
  email_send: "Sent email",
  email_draft_save: "Saved email draft",
  email_draft_delete: "Deleted email draft",
  email_template_create: "Created email template",
  email_template_update: "Updated email template",
  email_template_delete: "Deleted email template",
  // Call
  call_initiate: "Initiated phone call",
  call_receive: "Received phone call",
  call_complete: "Completed phone call",
  call_record_view: "Viewed call recording",
  call_transcript_view: "Viewed call transcript",
  voicemail_listen: "Listened to voicemail",
  // User management
  user_view: "Viewed user profile",
  user_create: "Created new user",
  user_update: "Updated user information",
  user_delete: "Deleted user",
  user_deactivate: "Deactivated user account",
  user_reactivate: "Reactivated user account",
  user_role_change: "Changed user role",
  user_permissions_update: "Updated user permissions",
  user_invite: "Invited new user",
  // Settings
  settings_view: "Viewed settings",
  settings_update: "Updated settings",
  integration_connect: "Connected integration",
  integration_disconnect: "Disconnected integration",
  api_key_create: "Created API key",
  api_key_revoke: "Revoked API key",
  webhook_create: "Created webhook",
  webhook_update: "Updated webhook",
  webhook_delete: "Deleted webhook",
  // Billing
  billing_view: "Viewed billing information",
  payment_method_add: "Added payment method",
  payment_method_remove: "Removed payment method",
  subscription_change: "Changed subscription",
  invoice_download: "Downloaded invoice",
  // System
  backup_create: "Created system backup",
  backup_restore: "Restored from backup",
  data_import: "Imported data",
  data_export: "Exported data",
  bulk_operation: "Performed bulk operation",
  // Security
  security_alert: "Security alert triggered",
  ip_blocked: "IP address blocked",
  suspicious_activity: "Suspicious activity detected",
  permission_denied: "Permission denied",
  // API
  api_request: "API request made",
  api_error: "API error occurred",
};

interface AuditContextType {
  log: (options: {
    category: AuditCategory;
    action: AuditAction;
    resource?: AuditResource;
    changes?: AuditChange[];
    status?: AuditStatus;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }) => void;
  logWithDuration: (options: {
    category: AuditCategory;
    action: AuditAction;
    resource?: AuditResource;
    changes?: AuditChange[];
    metadata?: Record<string, unknown>;
    tags?: string[];
  }) => () => void;
  getRecentLogs: (count?: number) => AuditLogEntry[];
  getSessionLogs: () => AuditLogEntry[];
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

// In-memory storage for demo (would be database in production)
const auditLogs: AuditLogEntry[] = [];
const MAX_LOGS = 10000;

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const sessionIdRef = useRef<string>(generateId());
  const sessionStartRef = useRef<Date>(new Date());

  // Track page views
  useEffect(() => {
    if (typeof window !== "undefined" && user) {
      const handleRouteChange = () => {
        // Could log page views here if desired
      };

      window.addEventListener("popstate", handleRouteChange);
      return () => window.removeEventListener("popstate", handleRouteChange);
    }
  }, [user]);

  const log = useCallback(
    (options: {
      category: AuditCategory;
      action: AuditAction;
      resource?: AuditResource;
      changes?: AuditChange[];
      status?: AuditStatus;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
    }) => {
      const status = options.status || "success";
      const severity = getSeverityForAction(options.action, status);

      const userAgent = typeof window !== "undefined" ? navigator.userAgent : "Server";

      const entry: AuditLogEntry = {
        id: generateId(),
        timestamp: new Date(),

        // User info
        userId: user?.id || "anonymous",
        userEmail: user?.email || "anonymous@system",
        userName: user?.full_name || "Anonymous User",
        userRole: user?.role || "unknown",

        // Action
        category: options.category,
        action: options.action,
        description: actionDescriptions[options.action] || options.action,

        // Resource
        resource: options.resource,

        // Changes
        changes: options.changes,

        // Result
        status,
        severity,
        errorMessage: options.errorMessage,

        // Context
        ipAddress: "127.0.0.1", // Would get from request in production
        userAgent,
        userAgentInfo: parseUserAgent(userAgent),

        // Session
        sessionInfo: {
          sessionId: sessionIdRef.current,
          startedAt: sessionStartRef.current,
          lastActivityAt: new Date(),
        },

        // Metadata
        metadata: options.metadata,
        tags: options.tags,

        // Request path (if available)
        requestPath: typeof window !== "undefined" ? window.location.pathname : undefined,
      };

      // Add to logs (with size limit)
      auditLogs.unshift(entry);
      if (auditLogs.length > MAX_LOGS) {
        auditLogs.pop();
      }

      // In production, would also send to server/database
      if (process.env.NODE_ENV === "development") {
        console.log("[Audit]", entry.action, entry.description, entry);
      }

      return entry;
    },
    [user]
  );

  const logWithDuration = useCallback(
    (options: {
      category: AuditCategory;
      action: AuditAction;
      resource?: AuditResource;
      changes?: AuditChange[];
      metadata?: Record<string, unknown>;
      tags?: string[];
    }) => {
      const startTime = Date.now();
      const correlationId = generateId();

      // Return a function to call when the operation completes
      return (status: AuditStatus = "success", errorMessage?: string) => {
        const durationMs = Date.now() - startTime;

        log({
          ...options,
          status,
          errorMessage,
          metadata: {
            ...options.metadata,
            durationMs,
            correlationId,
          },
        });
      };
    },
    [log]
  );

  const getRecentLogs = useCallback((count = 100) => {
    return auditLogs.slice(0, count);
  }, []);

  const getSessionLogs = useCallback(() => {
    return auditLogs.filter(
      (log) => log.sessionInfo?.sessionId === sessionIdRef.current
    );
  }, []);

  return (
    <AuditContext.Provider
      value={{
        log,
        logWithDuration,
        getRecentLogs,
        getSessionLogs,
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error("useAudit must be used within an AuditProvider");
  }
  return context;
}

// Export the in-memory logs for the admin page
export function getAllAuditLogs(): AuditLogEntry[] {
  return [...auditLogs];
}

// Seed with mock data for demo
export function seedAuditLogs() {
  if (auditLogs.length > 0) return; // Already seeded

  const mockUsers = [
    { id: "u1", email: "tdaniel@botmakers.ai", name: "Tyler Daniel", role: "admin" },
    { id: "u2", email: "hunter@spencermcgaw.com", name: "Hunter McGaw", role: "manager" },
    { id: "u3", email: "sarah@spencermcgaw.com", name: "Sarah Johnson", role: "staff" },
    { id: "u4", email: "britney@spencermcgaw.com", name: "Britney Williams", role: "staff" },
  ];

  const mockActions: { category: AuditCategory; action: AuditAction; resource?: AuditResource }[] = [
    { category: "authentication", action: "login" },
    { category: "client", action: "client_view", resource: { type: "client", id: "CL001", name: "John Smith" } },
    { category: "client", action: "client_create", resource: { type: "client", id: "CL007", name: "New Corp LLC" } },
    { category: "client", action: "client_update", resource: { type: "client", id: "CL002", name: "ABC Corporation" } },
    { category: "client", action: "client_note_add", resource: { type: "client", id: "CL001", name: "John Smith" } },
    { category: "document", action: "document_upload", resource: { type: "document", id: "DOC001", name: "Tax Return 2023.pdf" } },
    { category: "document", action: "document_view", resource: { type: "document", id: "DOC002", name: "W-2 Forms.pdf" } },
    { category: "document", action: "document_analyze", resource: { type: "document", id: "DOC003", name: "Bank Statement.pdf" } },
    { category: "task", action: "task_create", resource: { type: "task", id: "TSK001", name: "Review Q4 financials" } },
    { category: "task", action: "task_complete", resource: { type: "task", id: "TSK002", name: "Send tax documents" } },
    { category: "email", action: "email_send", resource: { type: "email", id: "EM001", name: "Re: Tax Filing Status" } },
    { category: "email", action: "email_view", resource: { type: "email", id: "EM002", name: "Document Request" } },
    { category: "call", action: "call_initiate", resource: { type: "call", id: "CALL001", name: "Call with John Smith" } },
    { category: "call", action: "call_complete", resource: { type: "call", id: "CALL002", name: "Call with ABC Corp" } },
    { category: "settings", action: "settings_view" },
    { category: "settings", action: "settings_update" },
    { category: "user_management", action: "user_view", resource: { type: "user", id: "u3", name: "Sarah Johnson" } },
    { category: "authentication", action: "logout" },
    { category: "authentication", action: "login_failed" },
    { category: "security", action: "permission_denied" },
  ];

  const browsers = ["Chrome", "Firefox", "Safari", "Edge"];
  const oses = ["Windows", "macOS", "Linux"];
  const ipAddresses = ["192.168.1.100", "10.0.0.50", "172.16.0.25", "192.168.1.105"];

  // Generate 200 mock entries over the past 30 days
  for (let i = 0; i < 200; i++) {
    const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    const actionData = mockActions[Math.floor(Math.random() * mockActions.length)];
    const daysAgo = Math.floor(Math.random() * 30);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);

    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - daysAgo);
    timestamp.setHours(timestamp.getHours() - hoursAgo);
    timestamp.setMinutes(timestamp.getMinutes() - minutesAgo);

    const status: AuditStatus = Math.random() > 0.95 ? "failure" : "success";
    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const os = oses[Math.floor(Math.random() * oses.length)];

    const entry: AuditLogEntry = {
      id: generateId(),
      timestamp,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      category: actionData.category,
      action: actionData.action,
      description: actionDescriptions[actionData.action],
      resource: actionData.resource,
      status,
      severity: getSeverityForAction(actionData.action, status),
      ipAddress: ipAddresses[Math.floor(Math.random() * ipAddresses.length)],
      userAgent: `Mozilla/5.0 (${os}) ${browser}`,
      userAgentInfo: {
        browser,
        browserVersion: "120.0",
        os,
        osVersion: os === "Windows" ? "10" : os === "macOS" ? "14.0" : "Ubuntu 22.04",
        device: "Desktop",
        isMobile: false,
      },
      sessionInfo: {
        sessionId: `session-${user.id}-${daysAgo}`,
        startedAt: new Date(timestamp.getTime() - 3600000),
        lastActivityAt: timestamp,
      },
      requestPath: actionData.resource
        ? `/${actionData.category}s/${actionData.resource.id}`
        : `/${actionData.category}`,
    };

    auditLogs.push(entry);
  }

  // Sort by timestamp descending
  auditLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
