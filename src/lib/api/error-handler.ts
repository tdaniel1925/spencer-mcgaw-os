/**
 * Centralized API Error Handler
 *
 * Provides consistent error handling across all API routes with:
 * - Type-safe custom errors
 * - Validation error formatting
 * - Sentry integration
 * - Structured logging
 * - User-friendly error messages
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/nextjs';
import logger from '@/lib/logger';

/**
 * Custom application error class with status codes and error codes
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error codes for consistent client handling
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',

  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SUPABASE_ERROR: 'SUPABASE_ERROR',
  OPENAI_ERROR: 'OPENAI_ERROR',
  TWILIO_ERROR: 'TWILIO_ERROR',

  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;

/**
 * Pre-defined error responses for common scenarios
 */
export const CommonErrors = {
  unauthorized: () => new AppError('Not authenticated', 401, ErrorCodes.UNAUTHORIZED),
  forbidden: (resource?: string) =>
    new AppError(
      resource ? `You don't have permission to access ${resource}` : 'Access forbidden',
      403,
      ErrorCodes.FORBIDDEN
    ),
  notFound: (resource?: string) =>
    new AppError(resource ? `${resource} not found` : 'Resource not found', 404, ErrorCodes.NOT_FOUND),
  alreadyExists: (resource?: string) =>
    new AppError(resource ? `${resource} already exists` : 'Resource already exists', 409, ErrorCodes.ALREADY_EXISTS),
  validationError: (message: string) => new AppError(message, 400, ErrorCodes.VALIDATION_ERROR),
  rateLimitExceeded: () => new AppError('Too many requests. Please try again later.', 429, ErrorCodes.RATE_LIMIT_EXCEEDED),
  databaseError: (context?: Record<string, unknown>) =>
    new AppError('Database operation failed', 500, ErrorCodes.DATABASE_ERROR, context),
};

/**
 * Format Zod validation errors into user-friendly messages
 */
function formatZodError(error: ZodError) {
  const fieldErrors: Record<string, string[]> = {};

  error.issues.forEach(err => {
    const path = err.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });

  return {
    message: 'Validation failed',
    fields: fieldErrors,
    errors: error.issues.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Main error handler - call this in every API route catch block
 *
 * @param error - The caught error
 * @param context - Additional context for logging (userId, route, etc.)
 * @returns NextResponse with appropriate error status and message
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   try {
 *     // ... route logic
 *   } catch (error) {
 *     return handleApiError(error, {
 *       route: '/api/clients',
 *       method: 'POST',
 *       userId: user?.id
 *     });
 *   }
 * }
 * ```
 */
export function handleApiError(error: unknown, context?: Record<string, unknown>): NextResponse {
  // 1. Zod validation errors
  if (error instanceof ZodError) {
    const formatted = formatZodError(error);

    logger.warn('Validation error', {
      ...context,
      validationErrors: formatted.errors,
    });

    return NextResponse.json(
      {
        error: formatted.message,
        code: ErrorCodes.VALIDATION_ERROR,
        details: formatted.fields,
      },
      { status: 400 }
    );
  }

  // 2. Custom AppError instances
  if (error instanceof AppError) {
    // Log error with appropriate level
    if (error.statusCode >= 500) {
      logger.error(error.message, {
        ...context,
        ...error.context,
        errorCode: error.code,
        stack: error.stack,
      });

      // Send 5xx errors to Sentry
      Sentry.captureException(error, {
        extra: { ...error.context, ...context },
        tags: { errorCode: error.code },
      });
    } else if (error.statusCode >= 400) {
      logger.warn(error.message, {
        ...context,
        ...error.context,
        errorCode: error.code,
      });
    }

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // 3. Supabase/Postgres errors
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as { code: string; message: string; details?: string };

    // Map common Postgres error codes
    const statusCode = {
      '23505': 409, // unique_violation
      '23503': 409, // foreign_key_violation
      '23502': 400, // not_null_violation
      '22P02': 400, // invalid_text_representation
      '42P01': 500, // undefined_table
    }[dbError.code] || 500;

    const errorCode = {
      '23505': ErrorCodes.ALREADY_EXISTS,
      '23503': ErrorCodes.CONSTRAINT_VIOLATION,
      '23502': ErrorCodes.MISSING_REQUIRED_FIELD,
    }[dbError.code] || ErrorCodes.DATABASE_ERROR;

    logger.error('Database error', {
      ...context,
      dbCode: dbError.code,
      dbMessage: dbError.message,
      dbDetails: dbError.details,
    });

    Sentry.captureException(error, { extra: context });

    return NextResponse.json(
      {
        error: statusCode < 500 ? dbError.message : 'Database operation failed',
        code: errorCode,
      },
      { status: statusCode }
    );
  }

  // 4. Standard JavaScript errors
  if (error instanceof Error) {
    logger.error('Unexpected error', {
      ...context,
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    Sentry.captureException(error, { extra: context });

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        code: ErrorCodes.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }

  // 5. Unknown errors (shouldn't happen, but be safe)
  logger.error('Unknown error type', {
    ...context,
    error: JSON.stringify(error),
  });

  Sentry.captureException(new Error('Unknown error type'), {
    extra: { error, ...context },
  });

  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    },
    { status: 500 }
  );
}

/**
 * Async wrapper to automatically catch errors in API routes
 *
 * @example
 * ```typescript
 * export const GET = withErrorHandler(
 *   async (request: NextRequest) => {
 *     // Your route logic - errors automatically caught
 *     const data = await fetchData();
 *     return NextResponse.json({ data });
 *   },
 *   { route: '/api/clients', method: 'GET' }
 * );
 * ```
 */
export function withErrorHandler(
  handler: (request: Request, context?: any) => Promise<Response>,
  context?: Record<string, unknown>
) {
  return async (request: Request, routeContext?: any) => {
    try {
      return await handler(request, routeContext);
    } catch (error) {
      return handleApiError(error, {
        ...context,
        url: request.url,
        method: request.method,
      });
    }
  };
}
