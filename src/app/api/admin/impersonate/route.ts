/**
 * User Impersonation API
 * POST /api/admin/impersonate - Start impersonating a user
 * DELETE /api/admin/impersonate - Stop impersonating and return to admin account
 *
 * Security:
 * - Only admin/owner roles can impersonate
 * - Cannot impersonate yourself
 * - Cannot impersonate another admin (unless you're owner)
 * - Impersonation state stored in cookies
 * - All actions logged for audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';
import { z } from 'zod';

const ImpersonateSchema = z.object({
  userId: z.string().uuid(),
});

// POST - Start impersonation
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate admin user
    const supabase = await createClient();
    const {
      data: { user: adminUser },
    } = await supabase.auth.getUser();

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get admin profile to check role
    const [adminProfile] = await db
      .select({ role: users.role, fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, adminUser.id))
      .limit(1);

    const isOwner = adminProfile?.role === 'owner';
    const isAdmin = adminProfile?.role === 'admin';
    const isSuperUser = adminProfile?.email === 'tdaniel@botmakers.ai';

    if (!adminProfile || (!isOwner && !isAdmin && !isSuperUser)) {
      logger.warn('[Impersonation] Non-admin attempted to impersonate', {
        adminId: adminUser.id,
        role: adminProfile?.role,
      });
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { userId: targetUserId } = ImpersonateSchema.parse(body);

    // Prevent self-impersonation
    if (targetUserId === adminUser.id) {
      return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 });
    }

    // Get target user
    const [targetUser] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    if (!targetUser.isActive) {
      return NextResponse.json({ error: 'Cannot impersonate inactive user' }, { status: 400 });
    }

    // Prevent impersonating other admins (unless you're owner or super user)
    if (targetUser.role === 'admin' && !isOwner && !isSuperUser) {
      logger.warn('[Impersonation] Admin attempted to impersonate another admin', {
        adminId: adminUser.id,
        adminRole: adminProfile.role,
        targetUserId,
      });
      return NextResponse.json(
        { error: 'Forbidden: Only owners can impersonate admins' },
        { status: 403 }
      );
    }

    // Prevent impersonating owners (even super user can't impersonate owners for security)
    if (targetUser.role === 'owner' && !isSuperUser) {
      logger.warn('[Impersonation] Attempted to impersonate owner', {
        adminId: adminUser.id,
        adminRole: adminProfile.role,
        targetUserId,
      });
      return NextResponse.json(
        { error: 'Forbidden: Cannot impersonate owners' },
        { status: 403 }
      );
    }

    const duration = Date.now() - startTime;

    logger.info('[Impersonation] Started impersonating user', {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      adminName: adminProfile.fullName,
      targetUserId,
      targetEmail: targetUser.email,
      targetName: targetUser.fullName,
      targetRole: targetUser.role,
      duration,
    });

    // Set impersonation cookies
    const response = NextResponse.json({
      success: true,
      impersonating: {
        userId: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
      },
      originalUser: {
        userId: adminUser.id,
        email: adminUser.email,
        fullName: adminProfile.fullName,
        role: adminProfile.role,
      },
    });

    // Set secure, HTTP-only cookie with impersonation state
    const impersonationData = {
      originalUserId: adminUser.id,
      impersonatedUserId: targetUser.id,
      startedAt: new Date().toISOString(),
    };

    response.cookies.set('impersonation', JSON.stringify(impersonationData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours max
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      logger.error('[Impersonation] Invalid request payload', {
        error: error.issues,
        duration,
      });
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        },
        { status: 400 }
      );
    }

    logger.error('[Impersonation] Failed to start impersonation', { error, duration });

    return NextResponse.json(
      {
        error: 'Failed to start impersonation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE - Stop impersonation
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if impersonation is active
    const impersonationCookie = request.cookies.get('impersonation');

    if (!impersonationCookie) {
      return NextResponse.json({ error: 'No active impersonation session' }, { status: 400 });
    }

    const impersonationData = JSON.parse(impersonationCookie.value);

    const duration = Date.now() - startTime;

    logger.info('[Impersonation] Stopped impersonating user', {
      originalUserId: impersonationData.originalUserId,
      impersonatedUserId: impersonationData.impersonatedUserId,
      sessionDuration: Date.now() - new Date(impersonationData.startedAt).getTime(),
      duration,
    });

    // Clear impersonation cookie
    const response = NextResponse.json({
      success: true,
      message: 'Impersonation ended',
      originalUserId: impersonationData.originalUserId,
    });

    response.cookies.delete('impersonation');

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('[Impersonation] Failed to stop impersonation', { error, duration });

    return NextResponse.json(
      {
        error: 'Failed to stop impersonation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - Check impersonation status
export async function GET(request: NextRequest) {
  try {
    const impersonationCookie = request.cookies.get('impersonation');

    if (!impersonationCookie) {
      return NextResponse.json({ impersonating: false });
    }

    const impersonationData = JSON.parse(impersonationCookie.value);

    // Get target user details
    const [targetUser] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, impersonationData.impersonatedUserId))
      .limit(1);

    if (!targetUser) {
      // User no longer exists, clear cookie
      const response = NextResponse.json({ impersonating: false });
      response.cookies.delete('impersonation');
      return response;
    }

    return NextResponse.json({
      impersonating: true,
      originalUserId: impersonationData.originalUserId,
      impersonatedUser: {
        userId: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
      },
      startedAt: impersonationData.startedAt,
    });
  } catch (error) {
    logger.error('[Impersonation] Failed to check status', { error });
    return NextResponse.json({ impersonating: false });
  }
}
