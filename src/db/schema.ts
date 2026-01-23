import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "staff"]);
export const callStatusEnum = pgEnum("call_status", [
  "completed",
  "missed",
  "voicemail",
  "transferred",
]);
export const documentTypeEnum = pgEnum("document_type", [
  "tax_return",
  "w2",
  "1099",
  "k1",
  "bank_statement",
  "credit_card_statement",
  "receipt",
  "invoice",
  "payroll",
  "irs_notice",
  "other",
]);
export const documentStatusEnum = pgEnum("document_status", [
  "received",
  "processing",
  "filed",
  "needs_review",
]);
export const activityTypeEnum = pgEnum("activity_type", [
  "call_received",
  "call_made",
  "email_received",
  "email_sent",
  "document_received",
  "document_sent",
  "task_created",
  "task_completed",
  "client_created",
  "client_updated",
  "note_added",
  "form_submission",
  "webhook_received",
]);
export const folderTypeEnum = pgEnum("folder_type", ["personal", "team", "repository", "client"]);
export const permissionEnum = pgEnum("permission", ["view", "edit", "admin"]);
export const shareTypeEnum = pgEnum("share_type", ["link", "email", "internal"]);
export const sharePermissionEnum = pgEnum("share_permission", ["view", "download", "edit"]);
export const emailProviderEnum = pgEnum("email_provider", ["microsoft", "google", "imap"]);
export const emailCategoryEnum = pgEnum("email_category", [
  "primary",
  "work",
  "personal",
  "promotional",
  "updates",
  "forums",
  "social",
  "spam",
]);
export const emailImportanceEnum = pgEnum("email_importance", ["low", "normal", "high"]);
export const emailFolderEnum = pgEnum("email_folder", ["inbox", "sent", "drafts", "archive", "trash"]);
export const emailIntentEnum = pgEnum("email_intent", ["question", "request", "fyi", "urgent", "meeting_invite"]);
export const emailSentimentEnum = pgEnum("email_sentiment", ["positive", "neutral", "negative", "urgent"]);
export const syncStatusEnum = pgEnum("sync_status", ["idle", "syncing", "error", "paused"]);
export const webhookSubStatusEnum = pgEnum("webhook_sub_status", ["active", "expired", "failed", "none"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("staff"),
  phone: varchar("phone", { length: 20 }),
  isActive: boolean("is_active").notNull().default(true),
  notificationPreferences: jsonb("notification_preferences").default({
    email: true,
    sms: false,
    dashboard: true,
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Clients table
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientNumber: varchar("client_number", { length: 20 }).unique(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  alternatePhone: varchar("alternate_phone", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  companyName: varchar("company_name", { length: 255 }),
  taxId: varchar("tax_id", { length: 20 }),
  serviceTypes: jsonb("service_types").$type<string[]>(),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Organizations table (Multi-tenancy support)
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Action Types table (Configurable task categories)
export const taskActionTypes = pgTable("task_action_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).default("00000000-0000-0000-0000-000000000001"),
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  color: text("color").default("#6B7280"),
  icon: text("icon").default("clipboard"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tasks table (Main task records)
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).default("00000000-0000-0000-0000-000000000001"),

  // Core fields
  title: text("title").notNull(),
  description: text("description"),
  actionTypeId: uuid("action_type_id").references(() => taskActionTypes.id),

  // Source tracking
  sourceType: text("source_type").default("manual"), // 'manual', 'email', 'calendar', 'recurring', 'ai'
  sourceEmailId: text("source_email_id"),
  sourceCallId: uuid("source_call_id").references(() => calls.id),
  sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>().default({}),

  // Assignment
  clientId: uuid("client_id").references(() => clients.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  assignedBy: uuid("assigned_by").references(() => users.id),
  claimedBy: uuid("claimed_by").references(() => users.id),
  claimedAt: timestamp("claimed_at"),

  // Status and priority (TEXT fields with CHECK constraints in database)
  status: text("status").default("open"), // 'open', 'in_progress', 'waiting', 'completed', 'cancelled'
  priority: text("priority").default("medium"), // 'urgent', 'high', 'medium', 'low'

  // Dates
  dueDate: timestamp("due_date"),
  dueTime: timestamp("due_time"),
  alertThresholdHours: integer("alert_threshold_hours").default(24),
  completedAt: timestamp("completed_at"),
  startedAt: timestamp("started_at"),

  // AI fields
  aiConfidence: integer("ai_confidence"), // 0-100
  aiExtractedData: jsonb("ai_extracted_data").$type<Record<string, unknown>>().default({}),

  // Routing / Workflow
  nextActionTypeId: uuid("next_action_type_id").references(() => taskActionTypes.id),
  routedFromTaskId: uuid("routed_from_task_id"), // Self-reference handled in DB
  parentTaskId: uuid("parent_task_id"), // Self-reference handled in DB

  // Progress
  estimatedMinutes: integer("estimated_minutes"),
  actualMinutes: integer("actual_minutes"),
  progressPercent: integer("progress_percent").default(0),

  // Tags & Custom Fields
  tags: jsonb("tags").$type<string[]>().default([]),
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// Subtasks table (Checklist items within tasks - from older migration)
export const subtasks = pgTable("subtasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  completedBy: uuid("completed_by").references(() => users.id),
  position: integer("position").default(0),
  dueDate: timestamp("due_date"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Steps table (Checklist items - from taskpool system)
export const taskSteps = pgTable("task_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedBy: uuid("completed_by").references(() => users.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Notes table (Comments and notes on tasks)
export const taskNotes = pgTable("task_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Activity table (from older migration - unified activity feed)
export const taskActivity = pgTable("task_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(), // 'created', 'updated', 'completed', 'assigned', etc.
  description: text("description"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Activity Log table (from taskpool system - audit trail)
export const taskActivityLog = pgTable("task_activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  details: jsonb("details").default({}),
  performedBy: uuid("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Links table (Link related tasks together)
export const taskLinks = pgTable("task_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceTaskId: uuid("source_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  targetTaskId: uuid("target_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  linkType: text("link_type").notNull().default("related"), // 'related', 'blocks', 'blocked_by', 'duplicates', 'parent', 'child'
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Attachments table (Files attached to tasks)
export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").references(() => files.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Handoff History table (Track task handoffs between team members)
export const taskHandoffHistory = pgTable("task_handoff_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id").references(() => users.id),
  toUserId: uuid("to_user_id").references(() => users.id),
  reason: text("reason"),
  notes: text("notes"),
  handoffType: text("handoff_type").default("reassign"), // 'reassign', 'escalate', 'delegate', 'return'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI Training Feedback table (User feedback on AI suggestions for learning)
export const aiTrainingFeedback = pgTable("ai_training_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackType: text("feedback_type").notNull(), // 'task_classification', 'priority_suggestion', 'action_type', 'client_match', 'email_classification'

  // What was suggested
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  originalValue: text("original_value"),
  suggestedValue: text("suggested_value"),

  // User's choice
  accepted: boolean("accepted").notNull(),
  userValue: text("user_value"),
  userReason: text("user_reason"),

  // Metadata
  confidenceScore: integer("confidence_score"), // 0-100
  context: jsonb("context").default({}),

  // User Info
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Visibility Rules table (Control who can see which tasks)
export const taskVisibilityRules = pgTable("task_visibility_rules", {
  id: uuid("id").primaryKey().defaultRandom(),

  // What this rule applies to
  ruleType: text("rule_type").notNull(), // 'user', 'role', 'department', 'client'
  ruleValue: text("rule_value").notNull(),

  // Filter criteria
  actionTypeId: uuid("action_type_id").references(() => taskActionTypes.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  priority: text("priority"),

  // Permission
  canView: boolean("can_view").notNull().default(true),
  canClaim: boolean("can_claim").notNull().default(true),
  canEdit: boolean("can_edit").notNull().default(false),

  // Metadata
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Task Pools table (Named pools for grouping unclaimed tasks)
export const taskPools = pgTable("task_pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),

  // Settings
  autoAssignEnabled: boolean("auto_assign_enabled").notNull().default(false),
  roundRobinEnabled: boolean("round_robin_enabled").notNull().default(false),
  maxTasksPerUser: integer("max_tasks_per_user"),

  // Eligibility
  eligibleUserIds: jsonb("eligible_user_ids").$type<string[]>().default([]),
  eligibleRoles: jsonb("eligible_roles").$type<string[]>().default([]),
  eligibleDepartments: jsonb("eligible_departments").$type<string[]>().default([]),

  // Filters
  actionTypeIds: jsonb("action_type_ids").$type<string[]>().default([]),
  priorityFilter: jsonb("priority_filter").$type<string[]>().default([]),

  // Status
  isActive: boolean("is_active").notNull().default(true),

  // Metadata
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Recurrence table (Recurring task definitions)
export const taskRecurrence = pgTable("task_recurrence", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Template
  title: text("title").notNull(),
  description: text("description"),
  actionTypeId: uuid("action_type_id").references(() => taskActionTypes.id),
  clientId: uuid("client_id").references(() => clients.id),
  priority: text("priority").default("medium"),
  estimatedMinutes: integer("estimated_minutes"),
  tags: jsonb("tags").$type<string[]>().default([]),

  // Recurrence Pattern
  frequency: text("frequency").notNull(), // 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'
  intervalValue: integer("interval_value").notNull().default(1),
  dayOfWeek: jsonb("day_of_week").$type<number[]>(), // 0=Sunday, 6=Saturday
  dayOfMonth: jsonb("day_of_month").$type<number[]>(),
  monthOfYear: jsonb("month_of_year").$type<number[]>(),

  // Time Settings
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  dueTime: timestamp("due_time"),
  leadDays: integer("lead_days").default(0),

  // Assignment
  assignTo: uuid("assign_to").references(() => users.id),
  poolId: uuid("pool_id").references(() => taskPools.id),

  // Status
  isActive: boolean("is_active").notNull().default(true),
  lastGeneratedAt: timestamp("last_generated_at"),
  nextOccurrence: timestamp("next_occurrence"),

  // Metadata
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Calls table (for AI Phone Agent)
export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  vapiCallId: varchar("vapi_call_id", { length: 255 }).unique(),
  clientId: uuid("client_id").references(() => clients.id),
  callerPhone: varchar("caller_phone", { length: 20 }),
  callerName: varchar("caller_name", { length: 255 }),
  status: callStatusEnum("status").notNull(),
  direction: varchar("direction", { length: 20 }).notNull().default("inbound"),
  duration: integer("duration"),
  transcription: text("transcription"),
  summary: text("summary"),
  intent: varchar("intent", { length: 100 }),
  sentiment: varchar("sentiment", { length: 50 }),
  wasTransferred: boolean("was_transferred").default(false),
  transferredToId: uuid("transferred_to_id").references(() => users.id),
  recordingUrl: text("recording_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Documents table (for Document Intake Agent)
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id),
  type: documentTypeEnum("type").notNull(),
  status: documentStatusEnum("status").notNull().default("received"),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  sourceChannel: varchar("source_channel", { length: 50 }),
  sourceEmail: varchar("source_email", { length: 255 }),
  taxYear: integer("tax_year"),
  extractedData: jsonb("extracted_data").$type<Record<string, unknown>>(),
  processedById: uuid("processed_by_id").references(() => users.id),
  processedAt: timestamp("processed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Activity Log table (Audit Trail)
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: activityTypeEnum("type").notNull(),
  description: text("description").notNull(),
  userId: uuid("user_id").references(() => users.id),
  clientId: uuid("client_id").references(() => clients.id),
  taskId: uuid("task_id").references(() => tasks.id),
  callId: uuid("call_id").references(() => calls.id),
  documentId: uuid("document_id").references(() => documents.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Calendar Events table
export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  allDay: boolean("all_day").default(false),
  location: varchar("location", { length: 255 }),
  clientId: uuid("client_id").references(() => clients.id),
  createdById: uuid("created_by_id").references(() => users.id),
  assignedToId: uuid("assigned_to_id").references(() => users.id),
  color: varchar("color", { length: 20 }),
  isRecurring: boolean("is_recurring").default(false),
  recurrenceRule: text("recurrence_rule"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Folders table (File Management)
export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  parentId: uuid("parent_id"),
  ownerId: uuid("owner_id").references(() => users.id),
  folderType: folderTypeEnum("folder_type").notNull().default("personal"),
  clientId: uuid("client_id").references(() => clients.id),
  isRoot: boolean("is_root").notNull().default(false),
  color: varchar("color", { length: 20 }),
  icon: varchar("icon", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// Files table (File Management)
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 500 }).notNull(),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  description: text("description"),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").references(() => users.id),
  storagePath: text("storage_path").notNull(),
  storageBucket: varchar("storage_bucket", { length: 100 }).notNull().default("files"),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  fileExtension: varchar("file_extension", { length: 20 }),
  checksum: varchar("checksum", { length: 64 }),
  isStarred: boolean("is_starred").notNull().default(false),
  isTrashed: boolean("is_trashed").notNull().default(false),
  trashedAt: timestamp("trashed_at"),
  clientId: uuid("client_id").references(() => clients.id),
  version: integer("version").notNull().default(1),
  currentVersionId: uuid("current_version_id"),
  thumbnailPath: text("thumbnail_path"),
  previewGenerated: boolean("preview_generated").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  lastAccessedAt: timestamp("last_accessed_at"),
});

// File Versions table (Version Control)
export const fileVersions = pgTable("file_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  versionNumber: integer("version_number").notNull(),
  storagePath: text("storage_path").notNull(),
  storageBucket: varchar("storage_bucket", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: varchar("checksum", { length: 64 }),
  changeSummary: text("change_summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// File Shares table (Sharing & Permissions)
export const fileShares = pgTable("file_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }),
  shareToken: varchar("share_token", { length: 255 }).notNull().unique(),
  shareType: shareTypeEnum("share_type").notNull().default("link"),
  permission: sharePermissionEnum("permission").notNull().default("view"),
  passwordHash: text("password_hash"),
  maxDownloads: integer("max_downloads"),
  downloadCount: integer("download_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  message: text("message"),
  isActive: boolean("is_active").notNull().default(true),
});

// Folder Permissions table (Access Control)
export const folderPermissions = pgTable("folder_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }),
  permission: permissionEnum("permission").notNull().default("view"),
  inherited: boolean("inherited").notNull().default(false),
  grantedBy: uuid("granted_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Storage Quotas table (Resource Management)
export const storageQuotas = pgTable("storage_quotas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  quotaBytes: integer("quota_bytes").notNull().default(26843545600), // 25GB default
  usedBytes: integer("used_bytes").notNull().default(0),
  fileCount: integer("file_count").notNull().default(0),
  lastCalculatedAt: timestamp("last_calculated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// File Activity table (Audit Trail for Files)
export const fileActivity = pgTable("file_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().default({}),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Email Connections table (OAuth integrations)
export const emailConnections = pgTable("email_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: emailProviderEnum("provider").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted, optional for IMAP
  expiresAt: timestamp("expires_at"),
  scopes: jsonb("scopes").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  syncErrors: integer("sync_errors").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Email Threads table (conversation grouping)
export const emailThreads = pgTable("email_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  conversationId: varchar("conversation_id", { length: 500 }), // Microsoft's conversation ID
  subject: text("subject").notNull(),
  participants: jsonb("participants").$type<string[]>().notNull().default([]), // Array of email addresses
  participantNames: jsonb("participant_names").$type<string[]>().default([]), // Array of names
  messageCount: integer("message_count").notNull().default(0),
  unreadCount: integer("unread_count").notNull().default(0),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  firstMessageAt: timestamp("first_message_at"),
  lastMessageAt: timestamp("last_message_at"),
  lastActivityAt: timestamp("last_activity_at"), // Last read/archive/etc
  category: emailCategoryEnum("category"),
  priorityScore: integer("priority_score").default(50), // 0-100
  isArchived: boolean("is_archived").notNull().default(false),
  isMuted: boolean("is_muted").notNull().default(false),
  labels: jsonb("labels").$type<string[]>().default([]),
  clientId: uuid("client_id").references(() => clients.id), // If all messages are with same client
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Email Messages table
export const emailMessages = pgTable("email_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  connectionId: uuid("connection_id").references(() => emailConnections.id, { onDelete: "cascade" }).notNull(),
  threadId: uuid("thread_id").references(() => emailThreads.id, { onDelete: "cascade" }),
  messageId: varchar("message_id", { length: 500 }).notNull().unique(), // Microsoft's unique ID
  conversationId: varchar("conversation_id", { length: 500 }), // Microsoft's conversation grouping
  internetMessageId: varchar("internet_message_id", { length: 500 }), // RFC 2822 message ID
  // Content
  subject: text("subject"),
  fromEmail: varchar("from_email", { length: 255 }),
  fromName: varchar("from_name", { length: 255 }),
  toRecipients: jsonb("to_recipients").$type<Array<{ email: string; name: string }>>().default([]),
  ccRecipients: jsonb("cc_recipients").$type<Array<{ email: string; name: string }>>().default([]),
  bccRecipients: jsonb("bcc_recipients").$type<Array<{ email: string; name: string }>>().default([]),
  bodyPreview: varchar("body_preview", { length: 500 }),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  // Metadata
  receivedAt: timestamp("received_at"),
  sentAt: timestamp("sent_at"),
  importance: emailImportanceEnum("importance").default("normal"),
  isRead: boolean("is_read").notNull().default(false),
  isFlagged: boolean("is_flagged").notNull().default(false),
  isDraft: boolean("is_draft").notNull().default(false),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  attachmentCount: integer("attachment_count").default(0),
  // Organization
  category: emailCategoryEnum("category"),
  priorityScore: integer("priority_score").default(50), // 0-100, AI-generated
  labels: jsonb("labels").$type<string[]>().default([]),
  // Actions
  isArchived: boolean("is_archived").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  folder: emailFolderEnum("folder").default("inbox"),
  // AI analysis
  aiSummary: text("ai_summary"),
  aiSuggestedActions: jsonb("ai_suggested_actions").$type<string[]>(),
  aiDetectedIntent: emailIntentEnum("ai_detected_intent"),
  aiSentiment: emailSentimentEnum("ai_sentiment"),
  // Relations
  clientId: uuid("client_id").references(() => clients.id), // Auto-matched or manually linked
  relatedTaskIds: jsonb("related_task_ids").$type<string[]>().default([]), // Tasks created from this email
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Email Attachments table
export const emailAttachments = pgTable("email_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => emailMessages.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // Microsoft metadata
  attachmentId: varchar("attachment_id", { length: 255 }), // Microsoft's ID
  name: varchar("name", { length: 500 }).notNull(),
  contentType: varchar("content_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  isInline: boolean("is_inline").default(false),
  contentId: varchar("content_id", { length: 255 }), // For inline images
  // Storage
  storagePath: varchar("storage_path", { length: 1000 }), // Path in Supabase Storage
  storageBucket: varchar("storage_bucket", { length: 100 }).default("email-attachments"),
  downloadUrl: text("download_url"), // Temporary download URL
  downloadUrlExpiresAt: timestamp("download_url_expires_at"),
  // File system integration
  fileId: uuid("file_id").references(() => files.id), // If saved to document system
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Email Sync State table (tracks sync progress per connection)
export const emailSyncState = pgTable("email_sync_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").references(() => emailConnections.id, { onDelete: "cascade" }).notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // Sync tracking
  lastSyncAt: timestamp("last_sync_at"),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
  nextSyncScheduledAt: timestamp("next_sync_scheduled_at"),
  syncStatus: syncStatusEnum("sync_status").default("idle"),
  syncError: text("sync_error"),
  syncErrorCount: integer("sync_error_count").default(0),
  // Delta sync (for incremental updates)
  deltaToken: text("delta_token"), // Microsoft's delta link for efficient sync
  syncCursor: varchar("sync_cursor", { length: 500 }), // Last message ID processed
  // Webhook subscription
  webhookSubscriptionId: varchar("webhook_subscription_id", { length: 255 }), // Microsoft subscription ID
  webhookExpiresAt: timestamp("webhook_expires_at"),
  webhookStatus: webhookSubStatusEnum("webhook_status").default("none"),
  webhookNotificationUrl: text("webhook_notification_url"),
  // Stats
  totalMessagesSynced: integer("total_messages_synced").default(0),
  lastMessageCount: integer("last_message_count").default(0),
  syncDurationMs: integer("sync_duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Email AI Insights table (cache AI analysis to avoid re-processing)
export const emailAiInsights = pgTable("email_ai_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => emailMessages.id, { onDelete: "cascade" }).notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // AI results
  category: emailCategoryEnum("category"),
  priorityScore: integer("priority_score"),
  summary: text("summary"),
  detectedIntent: emailIntentEnum("detected_intent"),
  sentiment: emailSentimentEnum("sentiment"),
  suggestedActions: jsonb("suggested_actions").$type<string[]>(),
  keywords: jsonb("keywords").$type<string[]>(),
  entities: jsonb("entities").$type<Record<string, unknown>>(), // Names, companies, dates extracted
  // Task suggestions
  suggestedTasks: jsonb("suggested_tasks").$type<Array<Record<string, unknown>>>(),
  taskConfidence: integer("task_confidence"), // 0-100
  // Client matching
  suggestedClientId: uuid("suggested_client_id").references(() => clients.id),
  clientMatchConfidence: integer("client_match_confidence"), // 0-100
  clientMatchReasoning: text("client_match_reasoning"),
  // Processing metadata
  modelUsed: varchar("model_used", { length: 50 }).default("gpt-4o"),
  processingCostMillicents: integer("processing_cost_millicents"), // Cost in 1/1000 of a cent
  processingTimeMs: integer("processing_time_ms"),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  assignedClients: many(clients),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  activities: many(activityLogs),
  calendarEvents: many(calendarEvents),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [clients.assignedUserId],
    references: [users.id],
  }),
  tasks: many(tasks),
  calls: many(calls),
  documents: many(documents),
  activities: many(activityLogs),
  calendarEvents: many(calendarEvents),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  actionTypes: many(taskActionTypes),
  tasks: many(tasks),
}));

export const taskActionTypesRelations = relations(taskActionTypes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [taskActionTypes.organizationId],
    references: [organizations.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  actionType: one(taskActionTypes, {
    fields: [tasks.actionTypeId],
    references: [taskActionTypes.id],
  }),
  client: one(clients, {
    fields: [tasks.clientId],
    references: [clients.id],
  }),
  assignedTo: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  claimedBy: one(users, {
    fields: [tasks.claimedBy],
    references: [users.id],
    relationName: "claimedTasks",
  }),
  createdBy: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdTasks",
  }),
  sourceCall: one(calls, {
    fields: [tasks.sourceCallId],
    references: [calls.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "childTasks",
  }),
  subtasks: many(subtasks),
  steps: many(taskSteps),
  notes: many(taskNotes),
  activity: many(taskActivity),
  activityLog: many(taskActivityLog),
  links: many(taskLinks, { relationName: "sourceLinks" }),
  linkedFrom: many(taskLinks, { relationName: "targetLinks" }),
  attachments: many(taskAttachments),
  handoffs: many(taskHandoffHistory),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.taskId],
    references: [tasks.id],
  }),
  completedBy: one(users, {
    fields: [subtasks.completedBy],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [subtasks.createdBy],
    references: [users.id],
  }),
}));

export const taskStepsRelations = relations(taskSteps, ({ one }) => ({
  task: one(tasks, {
    fields: [taskSteps.taskId],
    references: [tasks.id],
  }),
  completedBy: one(users, {
    fields: [taskSteps.completedBy],
    references: [users.id],
  }),
}));

export const taskNotesRelations = relations(taskNotes, ({ one }) => ({
  task: one(tasks, {
    fields: [taskNotes.taskId],
    references: [tasks.id],
  }),
  createdBy: one(users, {
    fields: [taskNotes.createdBy],
    references: [users.id],
  }),
}));

export const taskActivityRelations = relations(taskActivity, ({ one }) => ({
  task: one(tasks, {
    fields: [taskActivity.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskActivity.userId],
    references: [users.id],
  }),
}));

export const taskActivityLogRelations = relations(taskActivityLog, ({ one }) => ({
  task: one(tasks, {
    fields: [taskActivityLog.taskId],
    references: [tasks.id],
  }),
  performedBy: one(users, {
    fields: [taskActivityLog.performedBy],
    references: [users.id],
  }),
}));

export const taskLinksRelations = relations(taskLinks, ({ one }) => ({
  sourceTask: one(tasks, {
    fields: [taskLinks.sourceTaskId],
    references: [tasks.id],
    relationName: "sourceLinks",
  }),
  targetTask: one(tasks, {
    fields: [taskLinks.targetTaskId],
    references: [tasks.id],
    relationName: "targetLinks",
  }),
  createdBy: one(users, {
    fields: [taskLinks.createdBy],
    references: [users.id],
  }),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAttachments.taskId],
    references: [tasks.id],
  }),
  file: one(files, {
    fields: [taskAttachments.fileId],
    references: [files.id],
  }),
  uploadedBy: one(users, {
    fields: [taskAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export const taskHandoffHistoryRelations = relations(taskHandoffHistory, ({ one }) => ({
  task: one(tasks, {
    fields: [taskHandoffHistory.taskId],
    references: [tasks.id],
  }),
  fromUser: one(users, {
    fields: [taskHandoffHistory.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [taskHandoffHistory.toUserId],
    references: [users.id],
  }),
}));

export const aiTrainingFeedbackRelations = relations(aiTrainingFeedback, ({ one }) => ({
  user: one(users, {
    fields: [aiTrainingFeedback.userId],
    references: [users.id],
  }),
}));

export const taskVisibilityRulesRelations = relations(taskVisibilityRules, ({ one }) => ({
  actionType: one(taskActionTypes, {
    fields: [taskVisibilityRules.actionTypeId],
    references: [taskActionTypes.id],
  }),
  client: one(clients, {
    fields: [taskVisibilityRules.clientId],
    references: [clients.id],
  }),
  createdBy: one(users, {
    fields: [taskVisibilityRules.createdBy],
    references: [users.id],
  }),
}));

export const taskPoolsRelations = relations(taskPools, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [taskPools.createdBy],
    references: [users.id],
  }),
  recurrences: many(taskRecurrence),
}));

export const taskRecurrenceRelations = relations(taskRecurrence, ({ one }) => ({
  actionType: one(taskActionTypes, {
    fields: [taskRecurrence.actionTypeId],
    references: [taskActionTypes.id],
  }),
  client: one(clients, {
    fields: [taskRecurrence.clientId],
    references: [clients.id],
  }),
  assignTo: one(users, {
    fields: [taskRecurrence.assignTo],
    references: [users.id],
  }),
  pool: one(taskPools, {
    fields: [taskRecurrence.poolId],
    references: [taskPools.id],
  }),
  createdBy: one(users, {
    fields: [taskRecurrence.createdBy],
    references: [users.id],
  }),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  client: one(clients, {
    fields: [calls.clientId],
    references: [clients.id],
  }),
  transferredTo: one(users, {
    fields: [calls.transferredToId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  processedBy: one(users, {
    fields: [documents.processedById],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [activityLogs.clientId],
    references: [clients.id],
  }),
  task: one(tasks, {
    fields: [activityLogs.taskId],
    references: [tasks.id],
  }),
  call: one(calls, {
    fields: [activityLogs.callId],
    references: [calls.id],
  }),
  document: one(documents, {
    fields: [activityLogs.documentId],
    references: [documents.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  client: one(clients, {
    fields: [calendarEvents.clientId],
    references: [clients.id],
  }),
  createdBy: one(users, {
    fields: [calendarEvents.createdById],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [calendarEvents.assignedToId],
    references: [users.id],
  }),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  owner: one(users, {
    fields: [folders.ownerId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [folders.clientId],
    references: [clients.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "subfolders",
  }),
  children: many(folders, { relationName: "subfolders" }),
  files: many(files),
  permissions: many(folderPermissions),
  shares: many(fileShares),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  folder: one(folders, {
    fields: [files.folderId],
    references: [folders.id],
  }),
  owner: one(users, {
    fields: [files.ownerId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [files.clientId],
    references: [clients.id],
  }),
  versions: many(fileVersions),
  shares: many(fileShares),
  activity: many(fileActivity),
}));

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  file: one(files, {
    fields: [fileVersions.fileId],
    references: [files.id],
  }),
  createdBy: one(users, {
    fields: [fileVersions.createdBy],
    references: [users.id],
  }),
}));

export const fileSharesRelations = relations(fileShares, ({ one }) => ({
  file: one(files, {
    fields: [fileShares.fileId],
    references: [files.id],
  }),
  folder: one(folders, {
    fields: [fileShares.folderId],
    references: [folders.id],
  }),
  createdBy: one(users, {
    fields: [fileShares.createdBy],
    references: [users.id],
  }),
}));

export const folderPermissionsRelations = relations(folderPermissions, ({ one }) => ({
  folder: one(folders, {
    fields: [folderPermissions.folderId],
    references: [folders.id],
  }),
  user: one(users, {
    fields: [folderPermissions.userId],
    references: [users.id],
  }),
  grantedBy: one(users, {
    fields: [folderPermissions.grantedBy],
    references: [users.id],
  }),
}));

export const storageQuotasRelations = relations(storageQuotas, ({ one }) => ({
  user: one(users, {
    fields: [storageQuotas.userId],
    references: [users.id],
  }),
}));

export const fileActivityRelations = relations(fileActivity, ({ one }) => ({
  file: one(files, {
    fields: [fileActivity.fileId],
    references: [files.id],
  }),
  folder: one(folders, {
    fields: [fileActivity.folderId],
    references: [folders.id],
  }),
  user: one(users, {
    fields: [fileActivity.userId],
    references: [users.id],
  }),
}));

export const emailConnectionsRelations = relations(emailConnections, ({ one, many }) => ({
  user: one(users, {
    fields: [emailConnections.userId],
    references: [users.id],
  }),
  messages: many(emailMessages),
  syncState: one(emailSyncState),
}));

export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  user: one(users, {
    fields: [emailThreads.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [emailThreads.clientId],
    references: [clients.id],
  }),
  messages: many(emailMessages),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one, many }) => ({
  user: one(users, {
    fields: [emailMessages.userId],
    references: [users.id],
  }),
  connection: one(emailConnections, {
    fields: [emailMessages.connectionId],
    references: [emailConnections.id],
  }),
  thread: one(emailThreads, {
    fields: [emailMessages.threadId],
    references: [emailThreads.id],
  }),
  client: one(clients, {
    fields: [emailMessages.clientId],
    references: [clients.id],
  }),
  attachments: many(emailAttachments),
  aiInsights: one(emailAiInsights),
}));

export const emailAttachmentsRelations = relations(emailAttachments, ({ one }) => ({
  message: one(emailMessages, {
    fields: [emailAttachments.messageId],
    references: [emailMessages.id],
  }),
  user: one(users, {
    fields: [emailAttachments.userId],
    references: [users.id],
  }),
  file: one(files, {
    fields: [emailAttachments.fileId],
    references: [files.id],
  }),
}));

export const emailSyncStateRelations = relations(emailSyncState, ({ one }) => ({
  connection: one(emailConnections, {
    fields: [emailSyncState.connectionId],
    references: [emailConnections.id],
  }),
  user: one(users, {
    fields: [emailSyncState.userId],
    references: [users.id],
  }),
}));

export const emailAiInsightsRelations = relations(emailAiInsights, ({ one }) => ({
  message: one(emailMessages, {
    fields: [emailAiInsights.messageId],
    references: [emailMessages.id],
  }),
  user: one(users, {
    fields: [emailAiInsights.userId],
    references: [users.id],
  }),
  suggestedClient: one(clients, {
    fields: [emailAiInsights.suggestedClientId],
    references: [clients.id],
  }),
}));

// Webhook Logs table (for monitoring webhook activity)
export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "parsing",
  "parsed",
  "stored",
  "failed",
]);

export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: varchar("event_id", { length: 255 }), // Unique event ID for deduplication
  endpoint: varchar("endpoint", { length: 100 }).notNull(),
  source: varchar("source", { length: 100 }),
  status: webhookStatusEnum("status").notNull().default("received"),
  httpMethod: varchar("http_method", { length: 10 }).notNull().default("POST"),
  headers: jsonb("headers").$type<Record<string, unknown>>(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  parsedData: jsonb("parsed_data").$type<Record<string, unknown>>(),
  aiParsingUsed: boolean("ai_parsing_used").default(false),
  aiConfidence: integer("ai_confidence"),
  aiSummary: text("ai_summary"), // Quick view of what AI extracted
  aiCategory: varchar("ai_category", { length: 50 }), // AI-determined category
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  processingTimeMs: integer("processing_time_ms"),
  resultCallId: uuid("result_call_id").references(() => calls.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  resultCall: one(calls, {
    fields: [webhookLogs.resultCallId],
    references: [calls.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type TaskActionType = typeof taskActionTypes.$inferSelect;
export type NewTaskActionType = typeof taskActionTypes.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Subtask = typeof subtasks.$inferSelect;
export type NewSubtask = typeof subtasks.$inferInsert;
export type TaskStep = typeof taskSteps.$inferSelect;
export type NewTaskStep = typeof taskSteps.$inferInsert;
export type TaskNote = typeof taskNotes.$inferSelect;
export type NewTaskNote = typeof taskNotes.$inferInsert;
export type TaskActivity = typeof taskActivity.$inferSelect;
export type NewTaskActivity = typeof taskActivity.$inferInsert;
export type TaskActivityLog = typeof taskActivityLog.$inferSelect;
export type NewTaskActivityLog = typeof taskActivityLog.$inferInsert;
export type TaskLink = typeof taskLinks.$inferSelect;
export type NewTaskLink = typeof taskLinks.$inferInsert;
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type NewTaskAttachment = typeof taskAttachments.$inferInsert;
export type TaskHandoffHistory = typeof taskHandoffHistory.$inferSelect;
export type NewTaskHandoffHistory = typeof taskHandoffHistory.$inferInsert;
export type AiTrainingFeedback = typeof aiTrainingFeedback.$inferSelect;
export type NewAiTrainingFeedback = typeof aiTrainingFeedback.$inferInsert;
export type TaskVisibilityRule = typeof taskVisibilityRules.$inferSelect;
export type NewTaskVisibilityRule = typeof taskVisibilityRules.$inferInsert;
export type TaskPool = typeof taskPools.$inferSelect;
export type NewTaskPool = typeof taskPools.$inferInsert;
export type TaskRecurrence = typeof taskRecurrence.$inferSelect;
export type NewTaskRecurrence = typeof taskRecurrence.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type FileVersion = typeof fileVersions.$inferSelect;
export type NewFileVersion = typeof fileVersions.$inferInsert;
export type FileShare = typeof fileShares.$inferSelect;
export type NewFileShare = typeof fileShares.$inferInsert;
export type FolderPermission = typeof folderPermissions.$inferSelect;
export type NewFolderPermission = typeof folderPermissions.$inferInsert;
export type StorageQuota = typeof storageQuotas.$inferSelect;
export type NewStorageQuota = typeof storageQuotas.$inferInsert;
export type FileActivity = typeof fileActivity.$inferSelect;
export type NewFileActivity = typeof fileActivity.$inferInsert;
export type EmailConnection = typeof emailConnections.$inferSelect;
export type NewEmailConnection = typeof emailConnections.$inferInsert;
export type EmailThread = typeof emailThreads.$inferSelect;
export type NewEmailThread = typeof emailThreads.$inferInsert;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type NewEmailMessage = typeof emailMessages.$inferInsert;
export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type NewEmailAttachment = typeof emailAttachments.$inferInsert;
export type EmailSyncState = typeof emailSyncState.$inferSelect;
export type NewEmailSyncState = typeof emailSyncState.$inferInsert;
export type EmailAiInsight = typeof emailAiInsights.$inferSelect;
export type NewEmailAiInsight = typeof emailAiInsights.$inferInsert;
