/**
 * Zod validation schemas for Task API routes
 */

import { z } from 'zod';
import { uuidSchema, notesSchema, tagsSchema, dateTimeSchema, metadataSchema } from './common';

/**
 * Task status enum - matches database CHECK constraint
 */
export const taskStatusSchema = z.enum([
  'open',
  'in_progress',
  'waiting',
  'completed',
  'cancelled',
]);

/**
 * Task priority enum - matches database CHECK constraint
 */
export const taskPrioritySchema = z.enum(['urgent', 'high', 'medium', 'low']);

/**
 * Task source type enum
 */
export const taskSourceTypeSchema = z.enum([
  'manual',
  'email',
  'calendar',
  'recurring',
  'ai',
  'webhook',
]);

/**
 * Create task schema (POST /api/tasks, POST /api/taskpool/tasks)
 */
export const createTaskSchema = z.object({
  // Required fields
  title: z.string().min(1, 'Title is required').max(500),

  // Optional fields
  description: notesSchema,

  // Classification
  actionTypeId: uuidSchema.optional().nullable(),

  // Source tracking
  sourceType: taskSourceTypeSchema.default('manual'),
  sourceEmailId: z.string().max(255).optional().nullable(),
  sourceCallId: uuidSchema.optional().nullable(),
  sourceMetadata: metadataSchema,

  // Assignment
  clientId: uuidSchema.optional().nullable(),
  assignedTo: uuidSchema.optional().nullable(),
  claimedBy: uuidSchema.optional().nullable(),

  // Status and priority
  status: taskStatusSchema.default('open'),
  priority: taskPrioritySchema.default('medium'),

  // Dates
  dueDate: dateTimeSchema.optional().nullable(),
  dueTime: dateTimeSchema.optional().nullable(),
  alertThresholdHours: z.number().int().min(0).max(168).default(24), // Max 1 week

  // AI fields
  aiConfidence: z.number().int().min(0).max(100).optional().nullable(),
  aiExtractedData: metadataSchema,

  // Routing
  nextActionTypeId: uuidSchema.optional().nullable(),
  routedFromTaskId: uuidSchema.optional().nullable(),
  parentTaskId: uuidSchema.optional().nullable(),

  // Progress
  estimatedMinutes: z.number().int().min(0).max(10000).optional().nullable(),
  progressPercent: z.number().int().min(0).max(100).default(0),

  // Tags & Custom Fields
  tags: tagsSchema,
  customFields: metadataSchema,

  // Organization (for multi-tenant)
  organizationId: uuidSchema.optional().nullable(),
});

/**
 * Update task schema (PUT/PATCH /api/tasks/[id])
 */
export const updateTaskSchema = createTaskSchema.partial().extend({
  // Additional fields that can be updated
  completedAt: dateTimeSchema.optional().nullable(),
  startedAt: dateTimeSchema.optional().nullable(),
  actualMinutes: z.number().int().min(0).max(10000).optional().nullable(),
});

/**
 * Query tasks schema (GET /api/tasks, GET /api/taskpool/tasks)
 */
export const queryTasksSchema = z.object({
  search: z.string().max(200).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assignedTo: uuidSchema.optional(),
  claimedBy: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  actionTypeId: uuidSchema.optional(),
  sourceType: taskSourceTypeSchema.optional(),
  dueBefore: dateTimeSchema.optional(),
  dueAfter: dateTimeSchema.optional(),
  createdAfter: dateTimeSchema.optional(),
  createdBefore: dateTimeSchema.optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt', 'updatedAt', 'title']).default('dueDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Task ID parameter validation
 */
export const taskIdSchema = z.object({
  id: uuidSchema,
});

/**
 * Assign task schema (POST /api/taskpool/tasks/[id]/assign)
 */
export const assignTaskSchema = z.object({
  assignedTo: uuidSchema,
  notes: z.string().max(1000).optional(),
});

/**
 * Claim task schema (POST /api/taskpool/tasks/[id]/claim)
 */
export const claimTaskSchema = z.object({
  notes: z.string().max(1000).optional(),
});

/**
 * Complete task schema (POST /api/taskpool/tasks/[id]/complete)
 */
export const completeTaskSchema = z.object({
  actualMinutes: z.number().int().min(0).max(10000).optional(),
  notes: z.string().max(1000).optional(),
  nextActionTypeId: uuidSchema.optional().nullable(),
});

/**
 * Task step schema (for subtasks/checklist items)
 */
export const taskStepSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

/**
 * Update task step schema
 */
export const updateTaskStepSchema = taskStepSchema.partial().extend({
  isCompleted: z.boolean().optional(),
});

/**
 * Task note schema (comments)
 */
export const taskNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000),
  isInternal: z.boolean().default(false),
});
