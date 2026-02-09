/**
 * Rate Limiting for API Routes
 *
 * Protects against:
 * - Brute force attacks
 * - DoS (Denial of Service)
 * - Resource exhaustion
 * - Spam/abuse
 *
 * Uses Upstash Redis for serverless-compatible rate limiting
 * Falls back to in-memory rate limiting if Redis is not configured
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * In-memory rate limiter (fallback when Redis not available)
 * WARNING: This is per-instance, not shared across serverless functions
 * Only use this for development. Use Redis in production!
 */
class InMemoryRateLimiter {
  private requests: Map<string, { count: number; resetAt: number }> = new Map();

  check(identifier: string, limit: number, windowMs: number): {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    // Clean up expired entries periodically
    if (this.requests.size > 10000) {
      for (const [key, value] of this.requests.entries()) {
        if (value.resetAt < now) {
          this.requests.delete(key);
        }
      }
    }

    // First request or expired window
    if (!entry || entry.resetAt < now) {
      this.requests.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      });

      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: now + windowMs,
      };
    }

    // Within window
    if (entry.count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: entry.resetAt,
      };
    }

    // Increment counter
    entry.count++;
    this.requests.set(identifier, entry);

    return {
      success: true,
      limit,
      remaining: limit - entry.count,
      reset: entry.resetAt,
    };
  }
}

const memoryLimiter = new InMemoryRateLimiter();

/**
 * Rate limit tiers
 */
export const RateLimits = {
  // API routes - general
  api: { limit: 100, window: 60 * 1000 }, // 100 requests per minute

  // Authentication - strict
  auth: { limit: 5, window: 60 * 1000 }, // 5 login attempts per minute
  authSignup: { limit: 3, window: 60 * 60 * 1000 }, // 3 signups per hour

  // Email - moderate
  emailSend: { limit: 10, window: 60 * 1000 }, // 10 emails per minute
  emailFetch: { limit: 50, window: 60 * 1000 }, // 50 email fetches per minute

  // SMS - strict (costs money)
  smsSend: { limit: 5, window: 60 * 1000 }, // 5 SMS per minute
  smsCampaign: { limit: 1, window: 60 * 60 * 1000 }, // 1 campaign start per hour

  // File operations
  fileUpload: { limit: 20, window: 60 * 1000 }, // 20 uploads per minute
  fileDownload: { limit: 50, window: 60 * 1000 }, // 50 downloads per minute

  // Webhooks - moderate
  webhook: { limit: 100, window: 60 * 1000 }, // 100 webhook calls per minute

  // AI operations - strict (costs money)
  aiRequest: { limit: 20, window: 60 * 1000 }, // 20 AI requests per minute

  // Database writes - moderate
  dbWrite: { limit: 30, window: 60 * 1000 }, // 30 writes per minute

  // Search/read operations - lenient
  dbRead: { limit: 100, window: 60 * 1000 }, // 100 reads per minute
} as const;

/**
 * Get client identifier for rate limiting
 * Priority: User ID > IP Address > Anonymous
 */
export function getClientIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';

  return `ip:${ip}`;
}

/**
 * Check rate limit
 *
 * @param identifier - Unique identifier for the client (user ID or IP)
 * @param limit - Number of allowed requests
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result with success status and headers
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<{
  success: boolean;
  headers: Record<string, string>;
}> {
  // Try Upstash Redis first (production)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowMs}ms`),
        prefix: 'ratelimit',
        analytics: true,
      });

      const { success, limit: maxLimit, reset, remaining } = await ratelimit.limit(identifier);

      return {
        success,
        headers: {
          'X-RateLimit-Limit': maxLimit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(reset).toISOString(),
        },
      };
    } catch (error) {
      console.warn('Redis rate limiting failed, falling back to in-memory:', error);
      // Fall through to in-memory limiter
    }
  }

  // Fallback to in-memory rate limiter (development)
  const result = memoryLimiter.check(identifier, limit, windowMs);

  return {
    success: result.success,
    headers: {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.reset).toISOString(),
    },
  };
}

/**
 * Rate limit middleware wrapper
 *
 * @example
 * ```typescript
 * import { withRateLimit, RateLimits } from '@/lib/api/rate-limit';
 *
 * export const POST = withRateLimit(
 *   async (request) => {
 *     // Your handler
 *     return NextResponse.json({ success: true });
 *   },
 *   RateLimits.emailSend
 * );
 * ```
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config: { limit: number; window: number }
) {
  return async (request: NextRequest) => {
    // Get identifier (prefer user ID if authenticated)
    const identifier = getClientIdentifier(request);

    // Check rate limit
    const rateLimitResult = await checkRateLimit(identifier, config.limit, config.window);

    // Rate limit exceeded
    if (!rateLimitResult.success) {
      const response = NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );

      // Add rate limit headers
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // Execute handler
    const response = await handler(request);

    // Add rate limit headers to successful response
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Simple rate limit check helper (for use in existing handlers)
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitCheck = await rateLimit(request, RateLimits.emailSend);
 *   if (!rateLimitCheck.success) {
 *     return rateLimitCheck.response;
 *   }
 *
 *   // Your handler logic...
 * }
 * ```
 */
export async function rateLimit(
  request: NextRequest,
  config: { limit: number; window: number },
  userId?: string
): Promise<{ success: boolean; response?: NextResponse }> {
  const identifier = getClientIdentifier(request, userId);
  const result = await checkRateLimit(identifier, config.limit, config.window);

  if (!result.success) {
    const response = NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      { status: 429 }
    );

    Object.entries(result.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return { success: false, response };
  }

  return { success: true };
}
