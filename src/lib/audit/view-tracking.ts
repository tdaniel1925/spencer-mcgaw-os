/**
 * View Tracking Audit Library
 *
 * Logs when users view sensitive communications (calls, emails, recordings)
 * for compliance and oversight purposes.
 */

import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import logger from "@/lib/logger";

interface ViewLogOptions {
  userId: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log when a user views a call record (transcript, summary, details)
 */
export async function logCallView(
  callId: string,
  options: ViewLogOptions
): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      type: "call_viewed",
      description: `Call record viewed by ${options.userEmail || options.userId}`,
      userId: options.userId,
      callId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: {
        viewedAt: new Date().toISOString(),
        ...options.metadata,
      },
    });
  } catch (error) {
    logger.error("[View Tracking] Failed to log call view", {
      error,
      callId,
      userId: options.userId,
    });
    // Don't throw - audit logging shouldn't break the request
  }
}

/**
 * Log when a user plays/accesses a call recording
 */
export async function logRecordingPlay(
  callId: string,
  recordingUrl: string,
  options: ViewLogOptions
): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      type: "recording_played",
      description: `Call recording accessed by ${options.userEmail || options.userId}`,
      userId: options.userId,
      callId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: {
        recordingUrl,
        playedAt: new Date().toISOString(),
        ...options.metadata,
      },
    });
  } catch (error) {
    logger.error("[View Tracking] Failed to log recording play", {
      error,
      callId,
      userId: options.userId,
    });
    // Don't throw - audit logging shouldn't break the request
  }
}

/**
 * Log when a user views an email message (body content)
 */
export async function logEmailView(
  emailId: string,
  options: ViewLogOptions
): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      type: "email_viewed",
      description: `Email viewed by ${options.userEmail || options.userId}`,
      userId: options.userId,
      emailId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: {
        viewedAt: new Date().toISOString(),
        ...options.metadata,
      },
    });
  } catch (error) {
    logger.error("[View Tracking] Failed to log email view", {
      error,
      emailId,
      userId: options.userId,
    });
    // Don't throw - audit logging shouldn't break the request
  }
}

/**
 * Helper to extract request metadata for audit logging
 */
export function extractRequestMetadata(request: Request): Pick<ViewLogOptions, "ipAddress" | "userAgent"> {
  const headers = request.headers;
  return {
    ipAddress:
      headers.get("x-forwarded-for") ||
      headers.get("x-real-ip") ||
      "unknown",
    userAgent: headers.get("user-agent") || "unknown",
  };
}
