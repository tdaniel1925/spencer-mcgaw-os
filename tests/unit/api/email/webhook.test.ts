/**
 * Email Webhook Tests
 * Tests for Resend webhook endpoint that receives forwarded emails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/email/webhook/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/ai/email-analyzer');
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { createClient } from '@/lib/supabase/server';
import { analyzeEmailForTask } from '@/lib/ai/email-analyzer';

describe('POST /api/email/webhook', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      single: vi.fn(() => mockSupabase),
      limit: vi.fn(() => mockSupabase),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
  });

  it('should process email and create potential task', async () => {
    // Mock user lookup
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'user-123',
        email: 'john@example.com',
        full_name: 'John Doe',
        is_active: true,
      },
      error: null,
    });

    // Mock potential task creation
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'task-123' },
      error: null,
    });

    // Mock AI analysis
    vi.mocked(analyzeEmailForTask).mockResolvedValue({
      success: true,
      shouldCreateTask: true,
      suggestion: {
        title: 'Prepare tax return',
        description: 'Client needs 2024 tax return',
        priority: 'high',
        dueDate: '2024-04-10',
        actionType: 'tax_preparation',
        confidence: 95,
        reasoning: 'Clear action item',
        extractedData: {},
      },
    });

    const requestBody = {
      from: 'john@example.com',
      to: ['crm@hmcgaw.com'],
      subject: 'Need 2024 tax return',
      text: 'Hi, I need my 2024 tax return prepared.',
      received_at: new Date().toISOString(),
    };

    const request = new NextRequest('http://localhost/api/email/webhook', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.potentialTaskId).toBe('task-123');
    expect(data.confidence).toBe(95);
  });

  it('should handle user not found', async () => {
    // Mock user not found
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'User not found' },
    });

    // Mock admin user lookup
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'admin-123' },
      error: null,
    });

    // Mock potential task creation for admin
    mockSupabase.insert.mockResolvedValue({
      data: { id: 'task-123' },
      error: null,
    });

    const requestBody = {
      from: 'unknown@example.com',
      to: ['crm@hmcgaw.com'],
      subject: 'Test email',
      text: 'Test body',
      received_at: new Date().toISOString(),
    };

    const request = new NextRequest('http://localhost/api/email/webhook', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('user not found');
  });

  it('should handle AI suggesting no task needed', async () => {
    // Mock user lookup
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'john@example.com',
        full_name: 'John Doe',
        is_active: true,
      },
      error: null,
    });

    // Mock AI analysis - no task needed
    vi.mocked(analyzeEmailForTask).mockResolvedValue({
      success: true,
      shouldCreateTask: false,
      suggestion: {
        title: '',
        description: '',
        priority: 'low',
        dueDate: null,
        actionType: null,
        confidence: 90,
        reasoning: 'Thank you email, no action needed',
        extractedData: {},
      },
    });

    const requestBody = {
      from: 'john@example.com',
      to: ['crm@hmcgaw.com'],
      subject: 'Thank you',
      text: 'Thanks for your help!',
      received_at: new Date().toISOString(),
    };

    const request = new NextRequest('http://localhost/api/email/webhook', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('no task needed');
  });

  it('should handle invalid webhook payload', async () => {
    const requestBody = {
      // Missing required fields
      subject: 'Test',
    };

    const request = new NextRequest('http://localhost/api/email/webhook', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid webhook payload');
  });

  it('should handle AI analysis failure', async () => {
    // Mock user lookup
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'john@example.com',
        full_name: 'John Doe',
        is_active: true,
      },
      error: null,
    });

    // Mock AI analysis failure
    vi.mocked(analyzeEmailForTask).mockResolvedValue({
      success: false,
      shouldCreateTask: false,
      error: 'OpenAI API error',
    });

    const requestBody = {
      from: 'john@example.com',
      to: ['crm@hmcgaw.com'],
      subject: 'Test',
      text: 'Test',
      received_at: new Date().toISOString(),
    };

    const request = new NextRequest('http://localhost/api/email/webhook', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to analyze email');
  });

  it('should extract email from reply-to header', async () => {
    // Mock user lookup
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'user-123',
        email: 'original@example.com',
        full_name: 'John Doe',
        is_active: true,
      },
      error: null,
    });

    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'task-123' },
      error: null,
    });

    vi.mocked(analyzeEmailForTask).mockResolvedValue({
      success: true,
      shouldCreateTask: true,
      suggestion: {
        title: 'Test task',
        description: 'Test',
        priority: 'medium',
        dueDate: null,
        actionType: null,
        confidence: 80,
        reasoning: 'Test',
        extractedData: {},
      },
    });

    const requestBody = {
      from: 'forwarder@gmail.com',
      reply_to: 'original@example.com', // Original sender
      to: ['crm@hmcgaw.com'],
      subject: 'Forwarded email',
      text: 'Test',
      received_at: new Date().toISOString(),
    };

    const request = new NextRequest('http://localhost/api/email/webhook', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
