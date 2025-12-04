// Comprehensive Audit Trail Types

// Action categories for grouping and filtering
export type AuditCategory =
  | "authentication"
  | "client"
  | "document"
  | "task"
  | "email"
  | "call"
  | "user_management"
  | "settings"
  | "billing"
  | "system"
  | "security"
  | "data_export"
  | "api";

// Specific action types within each category
export type AuditAction =
  // Authentication
  | "login"
  | "logout"
  | "login_failed"
  | "password_change"
  | "password_reset_request"
  | "password_reset_complete"
  | "session_expired"
  | "mfa_enabled"
  | "mfa_disabled"
  | "mfa_verified"
  // Client actions
  | "client_view"
  | "client_create"
  | "client_update"
  | "client_delete"
  | "client_archive"
  | "client_restore"
  | "client_note_add"
  | "client_note_edit"
  | "client_note_delete"
  | "client_assign"
  | "client_unassign"
  | "client_export"
  // Document actions
  | "document_view"
  | "document_upload"
  | "document_download"
  | "document_delete"
  | "document_share"
  | "document_assign"
  | "document_unassign"
  | "document_analyze"
  // Task actions
  | "task_view"
  | "task_create"
  | "task_update"
  | "task_delete"
  | "task_complete"
  | "task_reopen"
  | "task_assign"
  | "task_unassign"
  | "task_comment"
  // Email actions
  | "email_view"
  | "email_send"
  | "email_draft_save"
  | "email_draft_delete"
  | "email_template_create"
  | "email_template_update"
  | "email_template_delete"
  // Call actions
  | "call_initiate"
  | "call_receive"
  | "call_complete"
  | "call_record_view"
  | "call_transcript_view"
  | "voicemail_listen"
  // User management
  | "user_view"
  | "user_create"
  | "user_update"
  | "user_delete"
  | "user_deactivate"
  | "user_reactivate"
  | "user_role_change"
  | "user_permissions_update"
  | "user_invite"
  // Settings
  | "settings_view"
  | "settings_update"
  | "integration_connect"
  | "integration_disconnect"
  | "api_key_create"
  | "api_key_revoke"
  | "webhook_create"
  | "webhook_update"
  | "webhook_delete"
  // Billing
  | "billing_view"
  | "payment_method_add"
  | "payment_method_remove"
  | "subscription_change"
  | "invoice_download"
  // System
  | "backup_create"
  | "backup_restore"
  | "data_import"
  | "data_export"
  | "bulk_operation"
  // Security
  | "security_alert"
  | "ip_blocked"
  | "suspicious_activity"
  | "permission_denied"
  // API
  | "api_request"
  | "api_error";

// Severity levels for audit entries
export type AuditSeverity = "info" | "warning" | "error" | "critical";

// Status of the action
export type AuditStatus = "success" | "failure" | "pending" | "partial";

// User agent parsed info
export interface UserAgentInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  isMobile: boolean;
}

// Geolocation info from IP
export interface GeoLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

// Resource that was affected
export interface AuditResource {
  type: "client" | "document" | "task" | "email" | "call" | "user" | "setting" | "system";
  id: string;
  name?: string;
  // Additional identifiers
  parentId?: string;
  parentType?: string;
}

// Changes made (for update operations)
export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  // For sensitive fields, values might be masked
  masked?: boolean;
}

// Session information
export interface SessionInfo {
  sessionId: string;
  startedAt: Date;
  lastActivityAt: Date;
  expiresAt?: Date;
}

// Main audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: Date;

  // Who performed the action
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;

  // What was done
  category: AuditCategory;
  action: AuditAction;
  description: string;

  // Affected resource
  resource?: AuditResource;

  // Changes made (for updates)
  changes?: AuditChange[];

  // Result
  status: AuditStatus;
  severity: AuditSeverity;
  errorMessage?: string;
  errorCode?: string;

  // Context
  ipAddress: string;
  userAgent: string;
  userAgentInfo?: UserAgentInfo;
  geoLocation?: GeoLocation;

  // Session
  sessionInfo?: SessionInfo;

  // Request details
  requestId?: string;
  requestPath?: string;
  requestMethod?: string;

  // Additional metadata
  metadata?: Record<string, unknown>;

  // For linking related events
  correlationId?: string;
  parentEventId?: string;

  // Duration (for operations that take time)
  durationMs?: number;

  // Tags for custom filtering
  tags?: string[];
}

// Filters for querying audit logs
export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  userEmail?: string;
  categories?: AuditCategory[];
  actions?: AuditAction[];
  severities?: AuditSeverity[];
  statuses?: AuditStatus[];
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  searchQuery?: string;
  tags?: string[];
}

// Pagination options
export interface AuditLogPagination {
  page: number;
  limit: number;
  sortBy: "timestamp" | "severity" | "category" | "action";
  sortOrder: "asc" | "desc";
}

// Response from audit log query
export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Audit statistics
export interface AuditStats {
  totalEvents: number;
  eventsByCategory: Record<AuditCategory, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByStatus: Record<AuditStatus, number>;
  topUsers: { userId: string; userName: string; count: number }[];
  topActions: { action: AuditAction; count: number }[];
  recentAlerts: AuditLogEntry[];
  eventsOverTime: { date: string; count: number }[];
}

// Real-time audit event (for live monitoring)
export interface RealTimeAuditEvent extends AuditLogEntry {
  isNew: boolean;
  highlighted?: boolean;
}

// Audit retention policy
export interface AuditRetentionPolicy {
  enabled: boolean;
  retentionDays: number;
  archiveBeforeDelete: boolean;
  archiveLocation?: string;
  excludeCategories?: AuditCategory[];
}

// Export options
export interface AuditExportOptions {
  format: "csv" | "json" | "pdf";
  filters: AuditLogFilters;
  includeMetadata: boolean;
  includeChanges: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
}
