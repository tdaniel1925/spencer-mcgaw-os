/**
 * Zod validation schemas for Email API routes
 */

import { z } from 'zod';
import { emailSchema, uuidSchema, dateTimeSchema } from './common';

/**
 * Email category enum
 */
export const emailCategorySchema = z.enum([
  'primary',
  'work',
  'personal',
  'promotional',
  'updates',
  'forums',
  'social',
  'spam',
]);

/**
 * Email importance enum
 */
export const emailImportanceSchema = z.enum(['low', 'normal', 'high']);

/**
 * Email folder enum
 */
export const emailFolderSchema = z.enum(['inbox', 'sent', 'drafts', 'archive', 'trash']);

/**
 * Email intent enum
 */
export const emailIntentSchema = z.enum(['question', 'request', 'fyi', 'urgent', 'meeting_invite']);

/**
 * Email sentiment enum
 */
export const emailSentimentSchema = z.enum(['positive', 'neutral', 'negative', 'urgent']);

/**
 * Email attachment schema
 */
export const emailAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  size: z.number().int().min(1).max(25 * 1024 * 1024), // 25MB max per attachment
  contentId: z.string().max(255).optional(),
  isInline: z.boolean().default(false),
});

/**
 * Send email schema (POST /api/email/send, POST /api/emails/compose)
 */
export const sendEmailSchema = z.object({
  to: z.array(emailSchema).min(1, 'At least one recipient is required').max(50),
  cc: z.array(emailSchema).max(50).optional(),
  bcc: z.array(emailSchema).max(50).optional(),
  subject: z.string().min(1, 'Subject is required').max(998), // RFC 5322 limit
  body: z.string().min(1, 'Email body is required'),
  isHtml: z.boolean().default(true),
  replyTo: emailSchema.optional(),
  attachments: z.array(emailAttachmentSchema).max(10).optional(),
  clientId: uuidSchema.optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Reply to email schema (POST /api/emails/[id]/reply)
 */
export const replyEmailSchema = z.object({
  body: z.string().min(1, 'Reply body is required'),
  isHtml: z.boolean().default(true),
  replyAll: z.boolean().default(false),
  attachments: z.array(emailAttachmentSchema).max(10).optional(),
});

/**
 * Forward email schema (POST /api/emails/[id]/forward)
 */
export const forwardEmailSchema = z.object({
  to: z.array(emailSchema).min(1, 'At least one recipient is required').max(50),
  cc: z.array(emailSchema).max(50).optional(),
  body: z.string().optional(), // Optional message to add before forwarded content
  isHtml: z.boolean().default(true),
});

/**
 * Query emails schema (GET /api/emails, GET /api/email/inbox)
 */
export const queryEmailsSchema = z.object({
  search: z.string().max(200).optional(),
  folder: emailFolderSchema.optional(),
  category: emailCategorySchema.optional(),
  importance: emailImportanceSchema.optional(),
  clientId: uuidSchema.optional(),
  emailAccountId: uuidSchema.optional(),
  unreadOnly: z.coerce.boolean().optional(),
  hasAttachments: z.coerce.boolean().optional(),
  fromEmail: emailSchema.optional(),
  receivedAfter: dateTimeSchema.optional(),
  receivedBefore: dateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['receivedAt', 'subject', 'from']).default('receivedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Email classification schema (for AI training)
 */
export const emailClassificationSchema = z.object({
  category: emailCategorySchema.optional(),
  intent: emailIntentSchema.optional(),
  sentiment: emailSentimentSchema.optional(),
  clientId: uuidSchema.optional().nullable(),
  extractedActionItems: z.array(z.string()).max(20).optional(),
});

/**
 * Email training schema (POST /api/email/training)
 */
export const emailTrainingSchema = z.object({
  emailId: z.string().max(255),
  correctCategory: emailCategorySchema,
  correctIntent: emailIntentSchema.optional(),
  correctClientId: uuidSchema.optional().nullable(),
  feedback: z.string().max(500).optional(),
});

/**
 * Email sender rule schema (POST /api/email/sender-rules)
 */
export const emailSenderRuleSchema = z.object({
  senderEmail: emailSchema,
  senderName: z.string().max(255).optional(),
  action: z.enum(['categorize', 'assign_client', 'auto_archive', 'mark_important']),
  category: emailCategorySchema.optional(),
  clientId: uuidSchema.optional().nullable(),
  isActive: z.boolean().default(true),
});

/**
 * Email ID parameter validation
 */
export const emailIdSchema = z.object({
  id: z.string().max(255), // Email IDs from providers can be various formats
});
