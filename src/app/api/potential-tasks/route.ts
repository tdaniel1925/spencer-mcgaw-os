/**
 * Potential Tasks API
 * GET  /api/potential-tasks - List user's pending potential tasks
 * POST /api/potential-tasks - Approve or dismiss a potential task
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const ApprovePotentialTaskSchema = z.object({
  potentialTaskId: z.string().uuid('Valid potential task ID is required'),
  action: z.enum(['approve', 'dismiss']),
  dismissalReason: z.string().optional(),
  // Optional overrides when approving
  overrides: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
      dueDate: z.string().optional(),
      assignedTo: z.string().uuid().optional(),
    })
    .optional(),
});

// ============================================================================
// GET /api/potential-tasks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query potential tasks (user's tasks + unassigned tasks)
    let query = supabase
      .from('potential_tasks')
      .select(
        `
        id,
        user_id,
        source_email_from,
        source_email_subject,
        source_email_received_at,
        suggested_title,
        suggested_description,
        suggested_priority,
        suggested_due_date,
        ai_confidence,
        ai_reasoning,
        status,
        created_at,
        expires_at
      `
      )
      .or(`user_id.eq.${user.id},user_id.is.null`) // User's tasks OR unassigned (NULL)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Also filter out expired tasks if looking at pending
    if (status === 'pending') {
      query = query.gt('expires_at', new Date().toISOString());
    }

    const { data: potentialTasks, error: queryError } = await query;

    if (queryError) {
      logger.error('[API] Failed to fetch potential tasks', {
        userId: user.id,
        error: queryError,
      });

      return NextResponse.json(
        { error: 'Failed to fetch potential tasks' },
        { status: 500 }
      );
    }

    logger.info('[API] Fetched potential tasks', {
      userId: user.id,
      count: potentialTasks?.length || 0,
      status,
    });

    return NextResponse.json({
      success: true,
      potentialTasks: potentialTasks || [],
      count: potentialTasks?.length || 0,
    });
  } catch (error) {
    logger.error('[API] Get potential tasks error', { error });

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
// POST /api/potential-tasks (Approve or Dismiss)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    let validatedData: z.infer<typeof ApprovePotentialTaskSchema>;
    try {
      validatedData = ApprovePotentialTaskSchema.parse(body);
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

    // Get potential task
    const { data: potentialTask, error: fetchError } = await supabase
      .from('potential_tasks')
      .select('*')
      .eq('id', validatedData.potentialTaskId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !potentialTask) {
      logger.warn('[API] Potential task not found', {
        userId: user.id,
        potentialTaskId: validatedData.potentialTaskId,
      });

      return NextResponse.json(
        { error: 'Potential task not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (potentialTask.status !== 'pending') {
      return NextResponse.json(
        {
          error: 'Potential task already processed',
          status: potentialTask.status,
        },
        { status: 400 }
      );
    }

    // Handle dismissal
    if (validatedData.action === 'dismiss') {
      const { error: updateError } = await supabase
        .from('potential_tasks')
        .update({
          status: 'dismissed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          dismissal_reason: validatedData.dismissalReason || null,
        })
        .eq('id', validatedData.potentialTaskId);

      if (updateError) {
        logger.error('[API] Failed to dismiss potential task', {
          userId: user.id,
          potentialTaskId: validatedData.potentialTaskId,
          error: updateError,
        });

        return NextResponse.json(
          { error: 'Failed to dismiss potential task' },
          { status: 500 }
        );
      }

      logger.info('[API] Potential task dismissed', {
        userId: user.id,
        potentialTaskId: validatedData.potentialTaskId,
        reason: validatedData.dismissalReason,
      });

      return NextResponse.json({
        success: true,
        message: 'Potential task dismissed',
      });
    }

    // Handle approval - Create real task
    const taskData = {
      title:
        validatedData.overrides?.title || potentialTask.suggested_title,
      description:
        validatedData.overrides?.description ||
        potentialTask.suggested_description ||
        '',
      priority:
        validatedData.overrides?.priority ||
        potentialTask.suggested_priority ||
        'medium',
      due_date:
        validatedData.overrides?.dueDate ||
        potentialTask.suggested_due_date ||
        null,
      assigned_to:
        validatedData.overrides?.assignedTo || user.id,
      source_type: 'email',
      source_email_id: potentialTask.source_email_from,
      source_metadata: {
        potentialTaskId: potentialTask.id,
        originalFrom: potentialTask.source_email_from,
        originalSubject: potentialTask.source_email_subject,
        aiConfidence: potentialTask.ai_confidence,
      },
      ai_confidence: potentialTask.ai_confidence,
      ai_extracted_data: potentialTask.ai_extracted_data,
      status: 'open',
      created_by: user.id,
    };

    const { data: createdTask, error: createError } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('id, title, status')
      .single();

    if (createError) {
      logger.error('[API] Failed to create task from potential task', {
        userId: user.id,
        potentialTaskId: validatedData.potentialTaskId,
        error: createError,
      });

      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    // Update potential task status
    const { error: updateError } = await supabase
      .from('potential_tasks')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        created_task_id: createdTask.id,
      })
      .eq('id', validatedData.potentialTaskId);

    if (updateError) {
      logger.error('[API] Failed to update potential task after creating task', {
        userId: user.id,
        potentialTaskId: validatedData.potentialTaskId,
        taskId: createdTask.id,
        error: updateError,
      });

      // Task was created successfully, so still return success
    }

    logger.info('[API] Potential task approved and task created', {
      userId: user.id,
      potentialTaskId: validatedData.potentialTaskId,
      taskId: createdTask.id,
      title: createdTask.title,
    });

    return NextResponse.json({
      success: true,
      message: 'Task created successfully',
      task: {
        id: createdTask.id,
        title: createdTask.title,
        status: createdTask.status,
      },
    });
  } catch (error) {
    logger.error('[API] Approve/dismiss potential task error', { error });

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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
