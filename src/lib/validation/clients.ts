/**
 * Zod validation schemas for Client API routes
 */

import { z } from 'zod';
import { emailSchema, phoneSchema, addressSchema, notesSchema, tagsSchema, uuidSchema } from './common';

/**
 * Client status enum
 */
export const clientStatusSchema = z.enum(['active', 'inactive', 'archived', 'prospect']);

/**
 * Create client schema (POST /api/clients)
 */
export const createClientSchema = z.object({
  // Required fields
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),

  // Contact information
  email: emailSchema.optional().nullable(),
  phone: phoneSchema,
  alternatePhone: phoneSchema,

  // Address
  ...addressSchema.shape,

  // Business information
  companyName: z.string().max(255).optional().nullable(),
  taxId: z.string().max(20).optional().nullable(),

  // Service types (array of strings)
  serviceTypes: z.array(z.string()).optional().nullable(),

  // Assignment
  assignedUserId: uuidSchema.optional().nullable(),

  // Metadata
  notes: notesSchema,
  tags: tagsSchema,

  // Status
  status: clientStatusSchema.default('active'),
  isActive: z.boolean().default(true),
});

/**
 * Update client schema (PUT/PATCH /api/clients/[id])
 */
export const updateClientSchema = createClientSchema.partial();

/**
 * Query clients schema (GET /api/clients)
 */
export const queryClientsSchema = z.object({
  search: z.string().max(200).optional(),
  status: clientStatusSchema.or(z.literal('all')).optional(),
  assignedUserId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Client ID parameter validation
 */
export const clientIdSchema = z.object({
  id: uuidSchema,
});
