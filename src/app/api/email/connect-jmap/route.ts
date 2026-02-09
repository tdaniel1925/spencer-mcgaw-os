/**
 * JMAP Email Connection API
 * POST /api/email/connect-jmap
 *
 * Connects a user's JMAP email account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createJmapConnection, JmapConfigSchema } from '@/lib/email/jmap-client';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const ConnectJmapSchema = z.object({
  apiUrl: z.string().url('Valid JMAP API URL is required'),
  accountId: z.string().min(1, 'Account ID is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  bearer: z.string().optional(),
});

// ============================================================================
// POST /api/email/connect-jmap
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    let validatedData: z.infer<typeof ConnectJmapSchema>;
    try {
      validatedData = ConnectJmapSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.issues.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Create JMAP config
    const jmapConfig = {
      apiUrl: validatedData.apiUrl,
      accountId: validatedData.accountId,
      username: validatedData.username,
      password: validatedData.password,
      bearer: validatedData.bearer,
    };

    // Attempt connection
    const result = await createJmapConnection(user.id, jmapConfig);

    if (!result.success) {
      logger.warn('[API] JMAP connection failed', {
        userId: user.id,
        username: validatedData.username,
        error: result.error,
      });

      return NextResponse.json(
        { error: result.error || 'Failed to connect JMAP account' },
        { status: 400 }
      );
    }

    logger.info('[API] JMAP connection created', {
      userId: user.id,
      connectionId: result.connectionId,
      email: result.email,
    });

    return NextResponse.json({
      success: true,
      connectionId: result.connectionId,
      email: result.email,
      message: 'JMAP account connected successfully',
    });

  } catch (error) {
    logger.error('[API] JMAP connect error', { error });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS (CORS preflight)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
