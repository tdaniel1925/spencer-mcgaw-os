import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook signature verification utilities
 * Supports multiple webhook providers
 */

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify HMAC-SHA256 webhook signature
 * Used by most webhook providers (VAPI, Stripe, etc.)
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256"
): WebhookVerificationResult {
  if (!signature || !secret) {
    return { valid: false, error: "Missing signature or secret" };
  }

  try {
    const expectedSignature = createHmac(algorithm, secret)
      .update(payload, "utf8")
      .digest("hex");

    // Handle different signature formats
    const providedSignature = signature.startsWith("sha256=")
      ? signature.slice(7)
      : signature.startsWith("sha1=")
      ? signature.slice(5)
      : signature;

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(providedSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: "Invalid signature length" };
    }

    const valid = timingSafeEqual(sigBuffer, expectedBuffer);
    return { valid, error: valid ? undefined : "Signature mismatch" };
  } catch (error) {
    return { valid: false, error: "Signature verification failed" };
  }
}

/**
 * Verify VAPI webhook signature
 */
export function verifyVapiSignature(
  payload: string,
  signature: string | null
): WebhookVerificationResult {
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  // If no secret is configured, skip verification (development mode)
  if (!secret) {
    console.warn("VAPI_WEBHOOK_SECRET not configured - skipping signature verification");
    return { valid: true };
  }

  if (!signature) {
    return { valid: false, error: "Missing VAPI signature header" };
  }

  return verifyHmacSignature(payload, signature, secret);
}

/**
 * Verify generic call webhook signature
 */
export function verifyCallWebhookSignature(
  payload: string,
  signature: string | null
): WebhookVerificationResult {
  const secret = process.env.CALL_WEBHOOK_SECRET;

  // If no secret is configured, skip verification (development mode)
  if (!secret) {
    console.warn("CALL_WEBHOOK_SECRET not configured - skipping signature verification");
    return { valid: true };
  }

  if (!signature) {
    return { valid: false, error: "Missing webhook signature header" };
  }

  return verifyHmacSignature(payload, signature, secret);
}

/**
 * Check if webhook timestamp is within acceptable range (5 minutes)
 * Prevents replay attacks
 */
export function isTimestampValid(timestamp: string | number, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const webhookTime = typeof timestamp === "string" ? Date.parse(timestamp) : timestamp;

  if (isNaN(webhookTime)) {
    return false;
  }

  const now = Date.now();
  const age = Math.abs(now - webhookTime);

  return age <= maxAgeMs;
}

/**
 * Generate idempotency key from webhook data
 * Used to prevent processing the same webhook twice
 */
export function generateIdempotencyKey(eventId: string, timestamp: string | number): string {
  return `${eventId}-${timestamp}`;
}
