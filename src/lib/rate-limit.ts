/**
 * Simple in-memory rate limiter for API routes
 *
 * Usage:
 *   const limiter = rateLimit({ interval: 60000, limit: 100 });
 *   const result = limiter.check(identifier);
 *   if (!result.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

interface RateLimitConfig {
  /** Time window in milliseconds */
  interval: number;
  /** Maximum requests per interval */
  limit: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
// Note: This resets on server restart and doesn't work across multiple instances
// For production with multiple instances, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export function rateLimit(config: RateLimitConfig) {
  scheduleCleanup();

  return {
    check(identifier: string): RateLimitResult {
      const now = Date.now();
      const key = identifier;

      let entry = rateLimitStore.get(key);

      // If no entry or expired, create new one
      if (!entry || entry.resetAt < now) {
        entry = {
          count: 0,
          resetAt: now + config.interval,
        };
        rateLimitStore.set(key, entry);
      }

      // Increment count
      entry.count++;

      const remaining = Math.max(0, config.limit - entry.count);
      const success = entry.count <= config.limit;

      return {
        success,
        remaining,
        reset: entry.resetAt,
      };
    },
  };
}

// Pre-configured rate limiters for different use cases
export const rateLimiters = {
  // General API: 100 requests per minute per IP/user
  api: rateLimit({ interval: 60 * 1000, limit: 100 }),

  // Auth endpoints: 5 attempts per 15 minutes per IP
  auth: rateLimit({ interval: 15 * 60 * 1000, limit: 5 }),

  // Sensitive operations: 10 per minute
  sensitive: rateLimit({ interval: 60 * 1000, limit: 10 }),

  // Webhooks: 200 per minute per source
  webhook: rateLimit({ interval: 60 * 1000, limit: 200 }),
};

/**
 * Get client identifier for rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP
 */
export function getClientIdentifier(
  request: Request,
  userId?: string | null
): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get IP from headers (works behind proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ||
             request.headers.get("x-real-ip") ||
             "unknown";

  return `ip:${ip}`;
}

/**
 * Helper to create rate limit response
 */
export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.reset.toString(),
        "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
      },
    }
  );
}
