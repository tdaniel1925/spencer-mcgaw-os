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
]);

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
  serviceTypes: jsonb("service_types").default([]),
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
  metadata: jsonb("metadata").default({}),
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
  metadata: jsonb("metadata").default({}),
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
  extractedData: jsonb("extracted_data").default({}),
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
  metadata: jsonb("metadata").default({}),
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
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
