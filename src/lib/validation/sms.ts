/**
 * Zod validation schemas for SMS API routes
 */

import { z } from 'zod';
import { phoneSchema, uuidSchema, dateTimeSchema } from './common';

/**
 * SMS direction enum
 */
export const smsDirectionSchema = z.enum(['inbound', 'outbound']);

/**
 * SMS status enum
 */
export const smsStatusSchema = z.enum([
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'undelivered',
  'received',
]);

/**
 * Campaign status enum
 */
export const campaignStatusSchema = z.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']);

/**
 * Send SMS schema (POST /api/sms/messages)
 */
export const sendSmsSchema = z.object({
  to: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  body: z.string().min(1, 'Message body is required').max(1600), // Standard SMS limit
  from: phoneSchema.optional(), // Optional if account has default number
  clientId: uuidSchema.optional().nullable(),
  conversationId: uuidSchema.optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Query SMS messages schema (GET /api/sms/messages)
 */
export const querySmsSchema = z.object({
  search: z.string().max(200).optional(),
  direction: smsDirectionSchema.optional(),
  status: smsStatusSchema.optional(),
  conversationId: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  phoneNumber: phoneSchema.optional(),
  sentAfter: dateTimeSchema.optional(),
  sentBefore: dateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['sentAt', 'status']).default('sentAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Create SMS template schema (POST /api/sms/templates)
 */
export const createSmsTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  body: z.string().min(1, 'Template body is required').max(1600),
  variables: z.array(z.string()).max(10).optional(), // e.g., ['clientName', 'amount', 'dueDate']
  category: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

/**
 * Update SMS template schema (PUT /api/sms/templates/[id])
 */
export const updateSmsTemplateSchema = createSmsTemplateSchema.partial();

/**
 * Create SMS campaign schema (POST /api/sms/campaigns)
 */
export const createSmsCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200),
  message: z.string().min(1, 'Campaign message is required').max(1600),
  recipients: z.array(z.object({
    phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/),
    clientId: uuidSchema.optional().nullable(),
    variables: z.record(z.string(), z.string()).optional(), // For template variable substitution
  })).min(1, 'At least one recipient is required').max(1000),
  scheduledFor: dateTimeSchema.optional().nullable(),
  status: campaignStatusSchema.default('draft'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Update SMS campaign schema (PUT /api/sms/campaigns/[id])
 */
export const updateSmsCampaignSchema = createSmsCampaignSchema.partial();

/**
 * Create canned response schema (POST /api/sms/canned-responses)
 */
export const createCannedResponseSchema = z.object({
  trigger: z.string().min(1, 'Trigger phrase is required').max(100),
  response: z.string().min(1, 'Response is required').max(1600),
  category: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

/**
 * Update canned response schema (PUT /api/sms/canned-responses/[id])
 */
export const updateCannedResponseSchema = createCannedResponseSchema.partial();

/**
 * Auto-responder schema (POST /api/sms/auto-responders)
 */
export const createAutoResponderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  triggerKeywords: z.array(z.string()).min(1, 'At least one keyword is required').max(20),
  response: z.string().min(1, 'Response is required').max(1600),
  matchType: z.enum(['exact', 'contains', 'starts_with', 'ends_with']).default('contains'),
  isActive: z.boolean().default(true),
  activeHours: z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }).optional(),
  activeDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(), // 0=Sunday, 6=Saturday
});

/**
 * Update auto-responder schema (PUT /api/sms/auto-responders/[id])
 */
export const updateAutoResponderSchema = createAutoResponderSchema.partial();

/**
 * SMS settings schema (PUT /api/sms/settings)
 */
export const smsSettingsSchema = z.object({
  defaultFromNumber: phoneSchema,
  enableAutoResponders: z.boolean().default(true),
  enableDeliveryReports: z.boolean().default(true),
  quietHoursStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  quietHoursEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  signatureText: z.string().max(100).optional(),
});

/**
 * SMS ID parameter validation
 */
export const smsIdSchema = z.object({
  id: uuidSchema,
});

/**
 * Conversation ID parameter validation
 */
export const conversationIdSchema = z.object({
  id: uuidSchema,
});
