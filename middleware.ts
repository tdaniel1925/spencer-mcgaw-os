/**
 * Next.js Middleware - Route Protection & Session Management
 *
 * This middleware runs on EVERY request at the edge before reaching your application.
 * It handles:
 * - Supabase session refresh
 * - Route protection (auth required)
 * - Public route allowlist
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

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

  // 1. Update Supabase session (refresh tokens if needed)
  const supabaseResponse = await updateSession(request);

  // 2. Check if route requires authentication
  const isPublicRoute = matchesRoute(pathname, PUBLIC_ROUTES);
  const isProtectedRoute = matchesRoute(pathname, PROTECTED_ROUTES);

  // If it's not a protected route, allow through
  if (!isProtectedRoute || isPublicRoute) {
    return supabaseResponse;
  }

  // 3. Check for authentication token
  const token = request.cookies.get('sb-access-token')?.value;
  const hasSession = !!token;

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
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
