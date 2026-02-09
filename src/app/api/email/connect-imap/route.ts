/**
 * IMAP Email Connection API
 * POST /api/email/connect-imap
 *
 * Connects a user's IMAP email account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createImapConnection, ImapConfigSchema } from '@/lib/email/imap-client';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const ConnectImapSchema = z.object({
  host: z.string().min(1, 'IMAP host is required'),
  port: z.number().int().min(1).max(65535).default(993),
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
  tls: z.boolean().default(true),
});

// ============================================================================
// POST /api/email/connect-imap
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
    let validatedData: z.infer<typeof ConnectImapSchema>;
    try {
      validatedData = ConnectImapSchema.parse(body);
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

    // Create IMAP config
    const imapConfig: import('@/lib/email/imap-client').ImapConfig = {
      host: validatedData.host,
      port: validatedData.port,
      user: validatedData.email,
      password: validatedData.password,
      tls: validatedData.tls,
      authTimeout: 10000,
    };

    // Attempt connection
    const result = await createImapConnection(user.id, imapConfig);

    if (!result.success) {
      logger.warn('[API] IMAP connection failed', {
        userId: user.id,
        email: validatedData.email,
        error: result.error,
      });

      return NextResponse.json(
        { error: result.error || 'Failed to connect IMAP account' },
        { status: 400 }
      );
    }

    logger.info('[API] IMAP connection created', {
      userId: user.id,
      connectionId: result.connectionId,
      email: result.email,
    });

    return NextResponse.json({
      success: true,
      connectionId: result.connectionId,
      email: result.email,
      message: 'IMAP account connected successfully',
    });

  } catch (error) {
    logger.error('[API] IMAP connect error', { error });

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
