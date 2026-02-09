/**
 * EXAMPLE: Clients API Route with Full Production Patterns
 *
 * This file demonstrates how to implement ALL production-ready patterns:
 * - Error handling with try-catch
 * - Input validation with Zod
 * - Rate limiting
 * - Structured logging
 * - RBAC (Role-Based Access Control)
 * - Activity logging
 *
 * Use this as a template for updating all 140+ API routes!
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getApiUser, canViewAll } from '@/lib/auth/api-rbac';
import { handleApiError, CommonErrors } from '@/lib/api/error-handler';
import { createRequestLogger } from '@/lib/logger';
import { rateLimit, RateLimits } from '@/lib/api/rate-limit';
import {
  createClientSchema,
  queryClientsSchema,
} from '@/lib/validation/clients';

/**
 * GET /api/clients - List clients with filtering and pagination
 *
 * Query params:
 * - search: string (optional) - Search by name, email, or phone
 * - status: 'active' | 'inactive' | 'archived' | 'all' (optional)
 * - assignedUserId: UUID (optional) - Filter by assigned user
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 * - sortBy: 'name' | 'createdAt' | 'updatedAt' (default: 'name')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
 */
export async function GET(request: NextRequest) {
  const requestId = request.headers.get('X-Request-ID') || 'unknown';
  const log = createRequestLogger(requestId);

  try {
    // 1. Rate limiting
    const rateLimitCheck = await rateLimit(request, RateLimits.dbRead);
    if (!rateLimitCheck.success) {
      return rateLimitCheck.response;
    }

    // 2. Authentication
    const apiUser = await getApiUser();
    if (!apiUser) {
      throw CommonErrors.unauthorized();
    }

    // 3. Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validated = queryClientsSchema.parse(searchParams);

    log.apiRequest('GET', '/api/clients', {
      userId: apiUser.id,
      filters: validated,
    });

    // 4. Database query with RBAC
    const supabase = await createClient();
    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .order(validated.sortBy, { ascending: validated.sortOrder === 'asc' })
      .range(validated.offset, validated.offset + validated.limit - 1);

    // RBAC: Staff can only see clients they created or are assigned to
    if (!canViewAll(apiUser)) {
      query = query.or(`created_by.eq.${apiUser.id},assigned_user_id.eq.${apiUser.id}`);
    }

    // Apply filters
    if (validated.search) {
      query = query.or(
        `first_name.ilike.%${validated.search}%,last_name.ilike.%${validated.search}%,email.ilike.%${validated.search}%,phone.ilike.%${validated.search}%`
      );
    }

    if (validated.status && validated.status !== 'all') {
      query = query.eq('status', validated.status);
    }

    if (validated.assignedUserId) {
      query = query.eq('assigned_user_id', validated.assignedUserId);
    }

    const { data: clients, error, count } = await query;

    if (error) {
      throw CommonErrors.databaseError({ originalError: error });
    }

    // 5. Log successful response
    log.apiResponse('GET', '/api/clients', 200, undefined, {
      resultCount: clients?.length || 0,
      totalCount: count,
    });

    return NextResponse.json({
      clients,
      count,
      pagination: {
        limit: validated.limit,
        offset: validated.offset,
        hasMore: count ? validated.offset + validated.limit < count : false,
      },
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/clients',
      method: 'GET',
      requestId,
      userId: (await getApiUser())?.id,
    });
  }
}

/**
 * POST /api/clients - Create a new client
 *
 * Body: CreateClientSchema
 * {
 *   firstName: string (required)
 *   lastName: string (required)
 *   email?: string
 *   phone?: string
 *   ... (see validation schema for full fields)
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('X-Request-ID') || 'unknown';
  const log = createRequestLogger(requestId);

  try {
    // 1. Rate limiting (stricter for write operations)
    const rateLimitCheck = await rateLimit(request, RateLimits.dbWrite);
    if (!rateLimitCheck.success) {
      return rateLimitCheck.response;
    }

    // 2. Authentication
    const apiUser = await getApiUser();
    if (!apiUser) {
      throw CommonErrors.unauthorized();
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validated = createClientSchema.parse(body);

    log.apiRequest('POST', '/api/clients', {
      userId: apiUser.id,
      clientName: `${validated.firstName} ${validated.lastName}`,
    });

    // 4. Check for duplicate email (if provided)
    if (validated.email) {
      const supabase = await createClient();
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('email', validated.email)
        .maybeSingle();

      if (existing) {
        throw CommonErrors.alreadyExists('Client with this email');
      }
    }

    // 5. Create client
    const supabase = await createClient();
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        ...validated,
        created_by: apiUser.id,
      })
      .select()
      .single();

    if (error) {
      throw CommonErrors.databaseError({ originalError: error });
    }

    // 6. Log activity (fire-and-forget - don't block response)
    supabase
      .from('activity_log')
      .insert({
        user_id: apiUser.id,
        user_email: apiUser.email,
        action: 'created',
        resource_type: 'client',
        resource_id: client.id,
        resource_name: `${client.first_name} ${client.last_name}`,
      })
      .then(({ error }) => {
        if (error) {
          log.warn('Failed to log activity', { error });
        }
      });

    // 7. Log successful response
    log.apiResponse('POST', '/api/clients', 201, undefined, {
      clientId: client.id,
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/clients',
      method: 'POST',
      requestId,
      userId: (await getApiUser())?.id,
    });
  }
}
