/**
 * JMAP Connection API Tests
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { POST } from '@/app/api/email/connect-jmap/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/email/jmap-client');
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('POST /api/email/connect-jmap', () => {
  beforeAll(async () => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    }

    // Setup default mocks
    const { createClient } = await import('@/lib/supabase/server');
    const { createJmapConnection } = await import('@/lib/email/jmap-client');

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-123', email: 'test@test.com' } },
          error: null,
        })),
      },
    } as any);

    vi.mocked(createJmapConnection).mockResolvedValue({
      success: true,
      connectionId: 'conn-456',
      email: 'user@example.com',
    });
  });

  it('should reject request without authentication', async () => {
    const { createClient } = await import('@/lib/supabase/server');

    // Override the mock to return unauthorized
    vi.mocked(createClient).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: { message: 'Unauthorized' },
        })),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/email/connect-jmap', {
      method: 'POST',
      body: JSON.stringify({
        apiUrl: 'https://jmap.example.com/api',
        accountId: 'account-123',
        username: 'user@example.com',
        password: 'password123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should successfully connect JMAP account', async () => {
    const request = new NextRequest('http://localhost/api/email/connect-jmap', {
      method: 'POST',
      body: JSON.stringify({
        apiUrl: 'https://jmap.example.com/api',
        accountId: 'account-123',
        username: 'user@example.com',
        password: 'password123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.connectionId).toBe('conn-456');
    expect(data.email).toBe('user@example.com');
  });

  it('should handle JMAP connection failure', async () => {
    const { createJmapConnection } = await import('@/lib/email/jmap-client');

    vi.mocked(createJmapConnection).mockResolvedValueOnce({
      success: false,
      error: 'Failed to connect to JMAP server',
    });

    const request = new NextRequest('http://localhost/api/email/connect-jmap', {
      method: 'POST',
      body: JSON.stringify({
        apiUrl: 'https://jmap.example.com/api',
        accountId: 'account-123',
        username: 'user@example.com',
        password: 'wrongpassword',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Failed to connect to JMAP server');
  });

  it('should support bearer token authentication', async () => {
    const { createJmapConnection } = await import('@/lib/email/jmap-client');
    vi.mocked(createJmapConnection).mockResolvedValue({
      success: true,
      connectionId: 'conn-789',
      email: 'user@example.com',
    });

    const request = new NextRequest('http://localhost/api/email/connect-jmap', {
      method: 'POST',
      body: JSON.stringify({
        apiUrl: 'https://jmap.example.com/api',
        accountId: 'account-123',
        username: 'user@example.com',
        password: 'password123',
        bearer: 'Bearer token123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
