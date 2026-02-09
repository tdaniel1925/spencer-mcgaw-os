/**
 * Task Change Tracking Audit Library
 *
 * Logs detailed field-level changes to tasks for compliance and oversight.
 * Uses taskActivityLog table for granular before/after tracking.
 */

import { db } from "@/db";
import { taskActivityLog } from "@/db/schema";
import logger from "@/lib/logger";

interface TaskChange {
  fieldName: string;
  oldValue: string | null | undefined;
  newValue: string | null | undefined;
}

interface LogTaskChangesOptions {
  taskId: string;
  userId: string;
  action: string; // 'status_changed', 'priority_changed', 'assigned', 'updated', etc.
  changes: TaskChange[];
  details?: Record<string, unknown>;
}

/**
 * Convert value to string for storage (handles null/undefined)
 */
function valueToString(value: any): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Log detailed field-level changes to a task
 */
export async function logTaskChanges(options: LogTaskChangesOptions): Promise<void> {
  try {
    // Create individual log entries for each changed field
    const logEntries = options.changes
      .filter((change) => change.oldValue !== change.newValue)
      .map((change) => ({
        taskId: options.taskId,
        action: options.action,
        fieldName: change.fieldName,
        oldValue: valueToString(change.oldValue),
        newValue: valueToString(change.newValue),
        details: options.details || {},
        performedBy: options.userId,
      }));

    if (logEntries.length > 0) {
      await db.insert(taskActivityLog).values(logEntries);

      logger.info("[Task Audit] Logged task changes", {
        taskId: options.taskId,
        userId: options.userId,
        action: options.action,
        changesCount: logEntries.length,
      });
    }
  } catch (error) {
    logger.error("[Task Audit] Failed to log task changes", {
      error,
      taskId: options.taskId,
      userId: options.userId,
    });
    // Don't throw - audit logging shouldn't break the request
  }
}

/**
 * Helper to detect changes between old and new task objects
 */
export function detectTaskChanges(
  oldTask: Record<string, any>,
  updates: Record<string, any>
): TaskChange[] {
  const changes: TaskChange[] = [];
  const trackedFields = [
    'title',
    'description',
    'status',
    'priority',
    'due_date',
    'assigned_to',
    'client_id',
    'progress_percent',
    'estimated_minutes',
  ];

  for (const field of trackedFields) {
    if (updates.hasOwnProperty(field) && updates[field] !== oldTask[field]) {
      changes.push({
        fieldName: field,
        oldValue: oldTask[field],
        newValue: updates[field],
      });
    }
  }

  return changes;
}

/**
 * Get human-readable action name based on changes
 */
export function getActionName(changes: TaskChange[]): string {
  const fieldNames = changes.map((c) => c.fieldName);

  if (fieldNames.includes('status')) {
    const statusChange = changes.find((c) => c.fieldName === 'status');
    if (statusChange?.newValue === 'completed') {
      return 'task_completed';
    }
    if (statusChange?.newValue === 'in_progress') {
      return 'task_started';
    }
    return 'status_changed';
  }

  if (fieldNames.includes('assigned_to')) {
    return 'task_assigned';
  }

  if (fieldNames.includes('priority')) {
    return 'priority_changed';
  }

  if (fieldNames.length === 1) {
    return `${fieldNames[0]}_updated`;
  }

  return 'task_updated';
}
