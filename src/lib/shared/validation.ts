// Input validation utilities using a simple schema approach
// In production, consider using Zod for more robust validation

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ValidationSchema {
  [key: string]: {
    required?: boolean;
    type?: "string" | "number" | "boolean" | "email" | "phone" | "url" | "uuid";
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: unknown) => string | null;
  };
}

// Common patterns
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-\+\(\)]{10,20}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALPHANUMERIC_PATTERN = /^[a-zA-Z0-9\-_]+$/;

/**
 * Validate input against a schema
 */
export function validate(data: Record<string, unknown>, schema: ValidationSchema): ValidationResult {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // Type checks
    if (rules.type) {
      switch (rules.type) {
        case "string":
          if (typeof value !== "string") {
            errors.push(`${field} must be a string`);
          }
          break;
        case "number":
          if (typeof value !== "number" || isNaN(value)) {
            errors.push(`${field} must be a number`);
          }
          break;
        case "boolean":
          if (typeof value !== "boolean") {
            errors.push(`${field} must be a boolean`);
          }
          break;
        case "email":
          if (typeof value !== "string" || !EMAIL_PATTERN.test(value)) {
            errors.push(`${field} must be a valid email address`);
          }
          break;
        case "phone":
          if (typeof value !== "string" || !PHONE_PATTERN.test(value)) {
            errors.push(`${field} must be a valid phone number`);
          }
          break;
        case "url":
          try {
            new URL(value as string);
          } catch {
            errors.push(`${field} must be a valid URL`);
          }
          break;
        case "uuid":
          if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
            errors.push(`${field} must be a valid UUID`);
          }
          break;
      }
    }

    // String length checks
    if (typeof value === "string") {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
    }

    // Number range checks
    if (typeof value === "number") {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
    }

    // Pattern check
    if (rules.pattern && typeof value === "string" && !rules.pattern.test(value)) {
      errors.push(`${field} has an invalid format`);
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        errors.push(customError);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize a string to prevent injection attacks
 * Removes or escapes potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .replace(/[<>]/g, "") // Remove angle brackets (XSS)
    .replace(/'/g, "''") // Escape single quotes (SQL)
    .trim();
}

/**
 * Sanitize for OData filter (Microsoft Graph API)
 * Only allows alphanumeric, spaces, and basic punctuation
 */
export function sanitizeODataFilter(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .replace(/['"]/g, "") // Remove quotes
    .replace(/[()]/g, "") // Remove parentheses
    .replace(/\$/g, "") // Remove OData operators
    .replace(/[&|;]/g, "") // Remove logical operators
    .trim()
    .slice(0, 100); // Limit length
}

/**
 * Validate that an ID is safe (alphanumeric, dashes, underscores only)
 */
export function isValidId(id: string): boolean {
  if (typeof id !== "string") return false;
  return ALPHANUMERIC_PATTERN.test(id) && id.length <= 100;
}

/**
 * Sanitize an array of IDs
 */
export function sanitizeIds(ids: unknown[]): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter((id): id is string => typeof id === "string" && isValidId(id))
    .slice(0, 100); // Limit number of IDs
}
