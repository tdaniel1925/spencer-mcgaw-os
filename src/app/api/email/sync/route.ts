/**
 * Email Sync API
 * POST /api/email/sync
 *
 * Syncs emails from IMAP/JMAP connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncImapMessages } from '@/lib/email/imap-client';
import { syncJmapMessages } from '@/lib/email/jmap-client';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const SyncEmailSchema = z.object({
  connectionId: z.string().uuid('Valid connection ID is required'),
});

// ============================================================================
// POST /api/email/sync
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
    let validatedData: z.infer<typeof SyncEmailSchema>;
    try {
      validatedData = SyncEmailSchema.parse(body);
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

    // Verify connection belongs to user
    const { data: connection, error: connectionError } = await supabase
      .from('email_connections')
      .select('id, provider, metadata, user_id')
      .eq('id', validatedData.connectionId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Email connection not found' },
        { status: 404 }
      );
    }

    if (connection.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to access this connection' },
        { status: 403 }
      );
    }

    // Determine provider type and sync accordingly
    const metadata = connection.metadata as Record<string, any>;
    const isJmap = metadata.provider_type === 'jmap';
    const provider = isJmap ? 'JMAP' : 'IMAP';

    logger.info('[API] Starting email sync', {
      userId: user.id,
      connectionId: validatedData.connectionId,
      provider,
    });

    // Sync messages
    const result = isJmap
      ? await syncJmapMessages(validatedData.connectionId)
      : await syncImapMessages(validatedData.connectionId);

    if (!result.success) {
      logger.error('[API] Email sync failed', {
        userId: user.id,
        connectionId: validatedData.connectionId,
        provider,
        errors: result.errors,
      });

      return NextResponse.json(
        {
          error: 'Email sync failed',
          details: result.errors,
        },
        { status: 500 }
      );
    }

    logger.info('[API] Email sync completed', {
      userId: user.id,
      connectionId: validatedData.connectionId,
      provider,
      messagesSynced: result.messagesSynced,
      errorCount: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      provider,
      messagesSynced: result.messagesSynced,
      errors: result.errors,
      message: `Successfully synced ${result.messagesSynced} ${provider} messages`,
    });

  } catch (error) {
    logger.error('[API] Email sync error', { error });

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
