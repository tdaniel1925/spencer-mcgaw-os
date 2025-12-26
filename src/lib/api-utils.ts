/**
 * CodeBakers API Utilities
 * Standardized error handling, validation, and response patterns
 */

import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

// ============================================================================
// Types
// ============================================================================

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  data: T;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a successful API response
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

/**
 * Create an error API response
 */
export function errorResponse(
  message: string,
  code: string,
  status: number,
  details?: unknown
): NextResponse {
  const response: ApiError = { error: message, code };
  if (details !== undefined) {
    response.details = details;
  }
  return NextResponse.json(response, { status });
}

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

  // Rate Limiting
  RATE_LIMITED: "RATE_LIMITED",
} as const;

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Centralized API error handler
 * Use this in catch blocks to return consistent error responses
 */
export function handleApiError(error: unknown): NextResponse {
  // Zod validation errors
  if (error instanceof ZodError) {
    const formattedErrors = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    return errorResponse(
      "Validation failed",
      ErrorCodes.VALIDATION_ERROR,
      400,
      formattedErrors
    );
  }

  // Standard Error objects
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes("Not authenticated") ||
        error.message.includes("Unauthorized")) {
      return errorResponse(
        "Authentication required",
        ErrorCodes.UNAUTHORIZED,
        401
      );
    }

    if (error.message.includes("Not found") ||
        error.message.includes("no rows")) {
      return errorResponse(
        "Resource not found",
        ErrorCodes.NOT_FOUND,
        404
      );
    }

    if (error.message.includes("duplicate") ||
        error.message.includes("unique constraint")) {
      return errorResponse(
        "Resource already exists",
        ErrorCodes.CONFLICT,
        409
      );
    }

    // Database errors
    if (error.message.includes("database") ||
        error.message.includes("PGRST") ||
        error.message.includes("PostgreSQL")) {
      return errorResponse(
        "Database operation failed",
        ErrorCodes.DATABASE_ERROR,
        500
      );
    }

    // Generic error - don't expose internal details in production
    return errorResponse(
      process.env.NODE_ENV === "development"
        ? error.message
        : "An unexpected error occurred",
      ErrorCodes.INTERNAL_ERROR,
      500
    );
  }

  // Unknown error type
  return errorResponse(
    "An unexpected error occurred",
    ErrorCodes.INTERNAL_ERROR,
    500
  );
}

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Parse and validate request body against a Zod schema
 * Throws ZodError if validation fails (caught by handleApiError)
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

/**
 * Parse and validate query parameters against a Zod schema
 */
export function parseQuery<T>(
  request: Request,
  schema: ZodSchema<T>
): T {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  return schema.parse(params);
}

/**
 * Parse and validate path parameters
 */
export function parseParams<T>(
  params: Record<string, string>,
  schema: ZodSchema<T>
): T {
  return schema.parse(params);
}

// ============================================================================
// Auth Helper
// ============================================================================

/**
 * Require authentication - throws if not authenticated
 */
export function requireAuth(user: { id: string } | null): asserts user is { id: string } {
  if (!user) {
    throw new Error("Not authenticated");
  }
}

/**
 * Require specific role
 */
export function requireRole(
  userRole: string | undefined,
  allowedRoles: string[]
): void {
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new Error("Forbidden: insufficient permissions");
  }
}
