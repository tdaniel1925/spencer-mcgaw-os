/**
 * OpenAI Client
 * Centralized OpenAI configuration and client setup
 */

import OpenAI from 'openai';

// Validate environment (skip in test mode if mocked)
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const apiKey = process.env.OPENAI_API_KEY || (isTest ? 'test-key' : '');

if (!apiKey && !isTest) {
  throw new Error('Missing required environment variable: OPENAI_API_KEY');
}

export const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: isTest, // Allow in test environment
});

// Default models
export const MODELS = {
  GPT4: 'gpt-4o',
  GPT4_TURBO: 'gpt-4-turbo-preview',
  GPT4_VISION: 'gpt-4-vision-preview',
  GPT35: 'gpt-3.5-turbo',
  EMBEDDING: 'text-embedding-3-small',
  EMBEDDING_LARGE: 'text-embedding-3-large',
} as const;
