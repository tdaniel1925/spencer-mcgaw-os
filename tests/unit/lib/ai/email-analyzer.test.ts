/**
 * Email Analyzer Tests
 * Tests for AI-powered email analysis for task extraction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeEmailForTask } from '@/lib/ai/email-analyzer';
import type { EmailAnalysisInput } from '@/lib/ai/email-analyzer';

// Mock OpenAI
vi.mock('@/lib/ai/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { openai } from '@/lib/ai/openai';

describe('Email Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeEmailForTask', () => {
    it('should analyze email and suggest task creation', async () => {
      // Mock OpenAI response
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                shouldCreateTask: true,
                title: 'Prepare 2024 tax return',
                description: 'Client requesting tax return preparation',
                priority: 'high',
                dueDate: '2024-04-10',
                actionType: 'tax_preparation',
                confidence: 95,
                reasoning: 'Clear action item with deadline',
                extractedData: { year: '2024' },
              }),
            },
          },
        ],
        usage: { total_tokens: 500 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any);

      const input: EmailAnalysisInput = {
        from: 'client@example.com',
        subject: 'Need 2024 tax return',
        body: 'Hi, I need my 2024 tax return prepared. Filing is due April 15th.',
        receivedAt: new Date('2024-03-01'),
      };

      const result = await analyzeEmailForTask(input);

      expect(result.success).toBe(true);
      expect(result.shouldCreateTask).toBe(true);
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion?.title).toBe('Prepare 2024 tax return');
      expect(result.suggestion?.priority).toBe('high');
      expect(result.suggestion?.confidence).toBe(95);
    });

    it('should determine when no task is needed', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                shouldCreateTask: false,
                title: '',
                description: '',
                priority: 'low',
                dueDate: null,
                actionType: null,
                confidence: 90,
                reasoning: 'This is a thank you email with no actionable items',
                extractedData: {},
              }),
            },
          },
        ],
        usage: { total_tokens: 300 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any);

      const input: EmailAnalysisInput = {
        from: 'client@example.com',
        subject: 'Thank you',
        body: 'Thanks for the meeting yesterday. Looking forward to next steps.',
        receivedAt: new Date(),
      };

      const result = await analyzeEmailForTask(input);

      expect(result.success).toBe(true);
      expect(result.shouldCreateTask).toBe(false);
      expect(result.suggestion?.reasoning).toContain('no actionable items');
    });

    it('should handle validation errors', async () => {
      const input = {
        from: 'invalid-email', // Not a valid email
        subject: 'Test',
        body: 'Test body',
        receivedAt: new Date(),
      } as any;

      const result = await analyzeEmailForTask(input);

      expect(result.success).toBe(false);
      expect(result.shouldCreateTask).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle OpenAI API errors', async () => {
      vi.mocked(openai.chat.completions.create).mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const input: EmailAnalysisInput = {
        from: 'client@example.com',
        subject: 'Test',
        body: 'Test body',
        receivedAt: new Date(),
      };

      const result = await analyzeEmailForTask(input);

      expect(result.success).toBe(false);
      expect(result.shouldCreateTask).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
    });

    it('should extract priority correctly', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                shouldCreateTask: true,
                title: 'Urgent client matter',
                description: 'Client has emergency tax issue',
                priority: 'urgent',
                dueDate: new Date().toISOString().split('T')[0],
                actionType: 'client_meeting',
                confidence: 98,
                reasoning: 'Client emergency requires immediate attention',
                extractedData: {},
              }),
            },
          },
        ],
        usage: { total_tokens: 400 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any);

      const input: EmailAnalysisInput = {
        from: 'urgent@example.com',
        subject: 'URGENT: Tax emergency',
        body: 'I received an IRS notice and need help immediately!',
        receivedAt: new Date(),
      };

      const result = await analyzeEmailForTask(input);

      expect(result.success).toBe(true);
      expect(result.suggestion?.priority).toBe('urgent');
      expect(result.suggestion?.confidence).toBeGreaterThan(95);
    });

    it('should handle missing OpenAI response', async () => {
      const mockResponse = {
        choices: [],
        usage: { total_tokens: 0 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any);

      const input: EmailAnalysisInput = {
        from: 'client@example.com',
        subject: 'Test',
        body: 'Test',
        receivedAt: new Date(),
      };

      const result = await analyzeEmailForTask(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No response from OpenAI');
    });

    it('should extract due dates correctly', async () => {
      const dueDate = '2024-04-15';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                shouldCreateTask: true,
                title: 'File tax return',
                description: 'Client needs tax return filed',
                priority: 'high',
                dueDate,
                actionType: 'tax_preparation',
                confidence: 92,
                reasoning: 'Deadline mentioned in email',
                extractedData: { deadline: '2024-04-15' },
              }),
            },
          },
        ],
        usage: { total_tokens: 450 },
      };

      vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any);

      const input: EmailAnalysisInput = {
        from: 'client@example.com',
        subject: 'Tax filing needed',
        body: 'Please file my taxes by April 15th deadline.',
        receivedAt: new Date(),
      };

      const result = await analyzeEmailForTask(input);

      expect(result.success).toBe(true);
      expect(result.suggestion?.dueDate).toBe(dueDate);
    });
  });
});
