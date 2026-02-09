/**
 * IMAP Connection API Tests
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/email/connect-imap/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/email/imap-client');
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('POST /api/email/connect-imap', () => {
  beforeAll(async () => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    }

    // Setup default mocks
    const { createClient } = await import('@/lib/supabase/server');
    const { createImapConnection } = await import('@/lib/email/imap-client');

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-123', email: 'test@test.com' } },
          error: null,
        })),
      },
    } as any);

    vi.mocked(createImapConnection).mockResolvedValue({
      success: true,
      connectionId: 'conn-123',
      email: 'test@gmail.com',
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

    const request = new NextRequest('http://localhost/api/email/connect-imap', {
      method: 'POST',
      body: JSON.stringify({
        host: 'imap.gmail.com',
        port: 993,
        email: 'test@gmail.com',
        password: 'password123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should successfully connect IMAP account', async () => {
    const request = new NextRequest('http://localhost/api/email/connect-imap', {
      method: 'POST',
      body: JSON.stringify({
        host: 'imap.gmail.com',
        port: 993,
        email: 'test@gmail.com',
        password: 'password123',
        tls: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.connectionId).toBe('conn-123');
    expect(data.email).toBe('test@gmail.com');
  });

  it('should handle IMAP connection failure', async () => {
    const { createImapConnection } = await import('@/lib/email/imap-client');

    vi.mocked(createImapConnection).mockResolvedValueOnce({
      success: false,
      error: 'Failed to connect to IMAP server',
    });

    const request = new NextRequest('http://localhost/api/email/connect-imap', {
      method: 'POST',
      body: JSON.stringify({
        host: 'imap.gmail.com',
        port: 993,
        email: 'test@gmail.com',
        password: 'wrongpassword',
        tls: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Failed to connect to IMAP server');
  });
});
