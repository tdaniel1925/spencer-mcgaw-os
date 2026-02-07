/**
 * Potential Tasks API Tests
 * Tests for listing, approving, and dismissing potential tasks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/potential-tasks/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { createClient } from '@/lib/supabase/server';

describe('Potential Tasks API', () => {
  let mockSupabase: any;
  const mockUser = {
    id: 'user-123',
    email: 'john@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create chainable mock query builder
    const createQueryBuilder = () => {
      const builder: any = {
        select: vi.fn(() => builder),
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gt: vi.fn(() => builder),
        order: vi.fn(() => builder),
        range: vi.fn(() => builder),
        single: vi.fn(() => builder),
        limit: vi.fn(() => builder),
      };
      return builder;
    };

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(() => createQueryBuilder()),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    // Default: user is authenticated
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('GET /api/potential-tasks', () => {
    it('should return list of pending potential tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          source_email_from: 'client@example.com',
          source_email_subject: 'Tax question',
          suggested_title: 'Answer tax question',
          suggested_priority: 'medium',
          ai_confidence: 85,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        {
          id: 'task-2',
          source_email_from: 'client2@example.com',
          source_email_subject: 'Document request',
          suggested_title: 'Send documents',
          suggested_priority: 'high',
          ai_confidence: 92,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ];

      // Mock the query builder chain
      const mockBuilder = mockSupabase.from();
      mockBuilder.range.mockResolvedValue({
        data: mockTasks,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/potential-tasks?status=pending');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.potentialTasks).toHaveLength(2);
      expect(data.count).toBe(2);
    });

    it('should filter by status', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/potential-tasks?status=approved');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'approved');
    });

    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = new NextRequest('http://localhost/api/potential-tasks');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle pagination', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/potential-tasks?limit=10&offset=20');

      await GET(request);

      expect(mockSupabase.range).toHaveBeenCalledWith(20, 29);
    });
  });

  describe('POST /api/potential-tasks (Approve)', () => {
    it('should approve potential task and create real task', async () => {
      const mockPotentialTask = {
        id: 'potential-123',
        user_id: 'user-123',
        source_email_from: 'client@example.com',
        source_email_subject: 'Tax help needed',
        suggested_title: 'Prepare tax return',
        suggested_description: 'Client needs help with 2024 taxes',
        suggested_priority: 'high',
        suggested_due_date: '2024-04-10',
        ai_confidence: 95,
        ai_extracted_data: { year: '2024' },
        status: 'pending',
      };

      // Mock potential task lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: mockPotentialTask,
        error: null,
      });

      // Mock task creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'task-123',
          title: 'Prepare tax return',
          status: 'open',
        },
        error: null,
      });

      // Mock potential task update
      mockSupabase.eq.mockReturnValue({
        update: vi.fn().mockResolvedValue({ error: null }),
      });

      const requestBody = {
        potentialTaskId: 'potential-123',
        action: 'approve',
      };

      const request = new NextRequest('http://localhost/api/potential-tasks', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.task.id).toBe('task-123');
      expect(data.task.title).toBe('Prepare tax return');
    });

    it('should dismiss potential task', async () => {
      const mockPotentialTask = {
        id: 'potential-123',
        user_id: 'user-123',
        status: 'pending',
      };

      // Mock potential task lookup
      mockSupabase.single.mockResolvedValue({
        data: mockPotentialTask,
        error: null,
      });

      // Mock update
      mockSupabase.eq.mockReturnValue({
        update: vi.fn().mockResolvedValue({ error: null }),
      });

      const requestBody = {
        potentialTaskId: 'potential-123',
        action: 'dismiss',
        dismissalReason: 'Not relevant',
      };

      const request = new NextRequest('http://localhost/api/potential-tasks', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('dismissed');
    });

    it('should reject if potential task not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const requestBody = {
        potentialTaskId: 'nonexistent',
        action: 'approve',
      };

      const request = new NextRequest('http://localhost/api/potential-tasks', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Potential task not found');
    });

    it('should reject if already processed', async () => {
      const mockPotentialTask = {
        id: 'potential-123',
        user_id: 'user-123',
        status: 'approved', // Already processed
      };

      mockSupabase.single.mockResolvedValue({
        data: mockPotentialTask,
        error: null,
      });

      const requestBody = {
        potentialTaskId: 'potential-123',
        action: 'approve',
      };

      const request = new NextRequest('http://localhost/api/potential-tasks', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('already processed');
    });

    it('should validate request body', async () => {
      const requestBody = {
        potentialTaskId: 'not-a-uuid',
        action: 'invalid-action',
      };

      const request = new NextRequest('http://localhost/api/potential-tasks', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should apply overrides when approving', async () => {
      const mockPotentialTask = {
        id: 'potential-123',
        user_id: 'user-123',
        suggested_title: 'Original title',
        suggested_description: 'Original description',
        suggested_priority: 'medium',
        status: 'pending',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockPotentialTask,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'task-123',
          title: 'Custom title',
          status: 'open',
        },
        error: null,
      });

      mockSupabase.eq.mockReturnValue({
        update: vi.fn().mockResolvedValue({ error: null }),
      });

      const requestBody = {
        potentialTaskId: 'potential-123',
        action: 'approve',
        overrides: {
          title: 'Custom title',
          priority: 'urgent',
        },
      };

      const request = new NextRequest('http://localhost/api/potential-tasks', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.task.title).toBe('Custom title');
    });
  });
});
