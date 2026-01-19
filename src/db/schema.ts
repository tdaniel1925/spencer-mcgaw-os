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
export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);
export const taskSourceEnum = pgEnum("task_source", [
  "phone_call",
  "email",
  "manual",
  "document_intake",
]);
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

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("pending"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  source: taskSourceEnum("source").notNull().default("manual"),
  sourceReferenceId: uuid("source_reference_id"),
  clientId: uuid("client_id").references(() => clients.id),
  assignedToId: uuid("assigned_to_id").references(() => users.id),
  createdById: uuid("created_by_id").references(() => users.id),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  completedById: uuid("completed_by_id").references(() => users.id),
  completionNotes: text("completion_notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
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

export const tasksRelations = relations(tasks, ({ one }) => ({
  client: one(clients, {
    fields: [tasks.clientId],
    references: [clients.id],
  }),
  assignedTo: one(users, {
    fields: [tasks.assignedToId],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: "createdTasks",
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
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
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
