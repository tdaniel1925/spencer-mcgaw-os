/**
 * Common Zod validation schemas used across the application
 */

import { z } from 'zod';

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Email validation
 */
export const emailSchema = z.string().email('Invalid email address').max(255);

/**
 * Phone number validation (E.164 format)
 */
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number. Use format: +1234567890')
  .optional()
  .nullable();

/**
 * URL validation
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Date/timestamp validation
 */
export const dateTimeSchema = z.union([
  z.string().datetime(),
  z.date(),
]).transform(val => typeof val === 'string' ? new Date(val) : val);

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Search query parameters
 */
export const searchSchema = z.object({
  search: z.string().max(200).optional(),
  ...paginationSchema.shape,
});

/**
 * Sort parameters
 */
export const sortSchema = z.object({
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Status enums
 */
export const activeStatusSchema = z.enum(['active', 'inactive', 'archived']);

/**
 * Common metadata that can be attached to resources
 */
export const metadataSchema = z.record(z.string(), z.unknown()).optional();

/**
 * Tag array (max 20 tags, each max 50 chars)
 */
export const tagsSchema = z
  .array(z.string().min(1).max(50))
  .max(20, 'Maximum 20 tags allowed')
  .default([]);

/**
 * Notes/description field
 */
export const notesSchema = z.string().max(10000).optional().nullable();

/**
 * File upload validation
 */
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  size: z.number().int().min(1).max(100 * 1024 * 1024), // 100MB max
});

/**
 * Address validation
 */
export const addressSchema = z.object({
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zipCode: z.string().max(20).optional().nullable(),
});
