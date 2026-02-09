/**
 * Bulk Operations Audit Library
 *
 * Logs bulk operations on tasks, communications, and other resources.
 */

import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import logger from "@/lib/logger";

interface BulkOperationOptions {
  userId: string;
  userEmail?: string;
  operation: "bulk_delete" | "bulk_assign" | "bulk_status_change" | "bulk_update";
  resourceType: "task" | "email" | "call" | "client";
  resourceIds: string[];
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log a bulk operation for audit trail
 */
export async function logBulkOperation(options: BulkOperationOptions): Promise<void> {
  try {
    const description = generateBulkOperationDescription(options);

    await db.insert(activityLogs).values({
      type: "task_updated", // Use existing enum value, details will clarify it's bulk
      description,
      userId: options.userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: {
        operation: options.operation,
        resourceType: options.resourceType,
        resourceIds: options.resourceIds,
        count: options.resourceIds.length,
        performedAt: new Date().toISOString(),
        performedBy: options.userEmail || options.userId,
        ...options.details,
      },
    });

    logger.info("[Bulk Operations] Logged bulk operation", {
      operation: options.operation,
      resourceType: options.resourceType,
      count: options.resourceIds.length,
      userId: options.userId,
    });
  } catch (error) {
    logger.error("[Bulk Operations] Failed to log bulk operation", {
      error,
      operation: options.operation,
      userId: options.userId,
    });
    // Don't throw - audit logging shouldn't break the request
  }
}

/**
 * Generate human-readable description for bulk operation
 */
function generateBulkOperationDescription(options: BulkOperationOptions): string {
  const { operation, resourceType, resourceIds, userEmail, userId, details } = options;
  const count = resourceIds.length;
  const user = userEmail || userId;

  switch (operation) {
    case "bulk_delete":
      return `Bulk deleted ${count} ${resourceType}(s) by ${user}`;

    case "bulk_assign":
      const assignee = details.assignedToName || details.assignedToId || "user";
      return `Bulk assigned ${count} ${resourceType}(s) to ${assignee} by ${user}`;

    case "bulk_status_change":
      const newStatus = details.newStatus || "unknown";
      return `Bulk changed status of ${count} ${resourceType}(s) to "${newStatus}" by ${user}`;

    case "bulk_update":
      const fields = Object.keys(details).filter((k) => !["operation", "performedBy"].includes(k));
      return `Bulk updated ${count} ${resourceType}(s) (${fields.join(", ")}) by ${user}`;

    default:
      return `Bulk ${operation} on ${count} ${resourceType}(s) by ${user}`;
  }
}

/**
 * Extract request metadata for bulk operations
 */
export function extractBulkRequestMetadata(request: Request): Pick<BulkOperationOptions, "ipAddress" | "userAgent"> {
  const headers = request.headers;
  return {
    ipAddress:
      headers.get("x-forwarded-for") ||
      headers.get("x-real-ip") ||
      "unknown",
    userAgent: headers.get("user-agent") || "unknown",
  };
}
