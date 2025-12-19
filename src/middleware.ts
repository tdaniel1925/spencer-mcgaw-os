import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Simple in-memory rate limiting for Edge runtime
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  return { success: entry.count <= limit, remaining };
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ||
         request.headers.get("x-real-ip") ||
         "unknown";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const ip = getClientIP(request);

    // Stricter limits for auth endpoints
    if (pathname.includes("/auth/") || pathname.includes("/login")) {
      const result = checkRateLimit(`auth:${ip}`, 10, 15 * 60 * 1000); // 10 per 15 min
      if (!result.success) {
        return NextResponse.json(
          { error: "Too many authentication attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": "900" } }
        );
      }
    }
    // Skip rate limiting for webhooks (they have their own verification)
    else if (!pathname.includes("/webhooks/")) {
      const result = checkRateLimit(`api:${ip}`, 100, 60 * 1000); // 100 per minute
      if (!result.success) {
        return NextResponse.json(
          { error: "Too many requests. Please slow down." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    }

    // Continue to API route
    return NextResponse.next();
  }

  // Session handling for non-API routes
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (handled by the callback route)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
