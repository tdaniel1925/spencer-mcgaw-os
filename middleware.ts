/**
 * Next.js Middleware - Route Protection & Session Management
 *
 * This middleware runs on EVERY request at the edge before reaching your application.
 * It handles:
 * - Supabase session refresh
 * - Route protection (auth required)
 * - Public route allowlist
 * - Rate limiting for API routes
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

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

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/privacy',
  '/api/auth',
  '/api/webhooks',
  '/api/email/webhook', // Resend inbound webhook
  '/api/cron', // Cron jobs (protected by CRON_SECRET in production)
  '/api/health',
  '/api/files/share', // Public file sharing
];

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/admin',
  '/clients',
  '/tasks',
  '/calendar',
  '/calls',
  '/email',
  '/sms',
  '/chat',
  '/files',
  '/reports',
  '/settings',
  '/api', // All API routes except public ones
];

/**
 * Check if a path matches any pattern in the list
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting for API routes (check early to prevent abuse)
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
    else if (!pathname.includes("/webhooks/") && !pathname.includes("/health")) {
      const result = checkRateLimit(`api:${ip}`, 200, 60 * 1000); // 200 per minute
      if (!result.success) {
        return NextResponse.json(
          { error: "Too many requests. Please slow down." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    }
  }

  // 2. Check if route requires authentication
  const isPublicRoute = matchesRoute(pathname, PUBLIC_ROUTES);
  const isProtectedRoute = matchesRoute(pathname, PROTECTED_ROUTES);

  // Skip session check for public routes (faster)
  if (!isProtectedRoute || isPublicRoute) {
    return NextResponse.next();
  }

  // 3. Update Supabase session and check for user (only for protected routes)
  const { supabaseResponse, user } = await updateSession(request);
  const hasSession = !!user;

  // 4. Protect API routes
  if (pathname.startsWith('/api') && !isPublicRoute) {
    if (!hasSession) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }
    // API route is authenticated, continue
    return supabaseResponse;
  }

  // 5. Protect page routes (redirect to login)
  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Redirect authenticated users away from auth pages
  if (hasSession && ['/login', '/signup'].includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 7. Handle root path redirect
  if (pathname === '/') {
    const redirectUrl = hasSession ? '/dashboard' : '/login';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, fonts, etc.)
     * - api/webhooks (public webhooks)
     * - api/health (health check)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/health|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js|map)$).*)',
  ],
};
