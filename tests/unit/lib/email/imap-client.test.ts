/**
 * IMAP Client Tests
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ImapConfigSchema, ImapClient } from '@/lib/email/imap-client';

describe('IMAP Client', () => {
  beforeAll(() => {
    // Set encryption key for testing
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    }
  });

  describe('ImapConfigSchema validation', () => {
    it('should validate correct IMAP config', () => {
      const config = {
        host: 'imap.gmail.com',
        port: 993,
        user: 'test@gmail.com',
        password: 'password123',
        tls: true,
      };

      const result = ImapConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.host).toBe(config.host);
        expect(result.data.port).toBe(config.port);
        expect(result.data.user).toBe(config.user);
        expect(result.data.password).toBe(config.password);
        expect(result.data.tls).toBe(config.tls);
      }
    });

    it('should apply default port 993', () => {
      const config = {
        host: 'imap.gmail.com',
        user: 'test@gmail.com',
        password: 'password123',
      };

      const result = ImapConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.port).toBe(993);
        expect(result.data.tls).toBe(true);
      }
    });

    it('should reject invalid email', () => {
      const config = {
        host: 'imap.gmail.com',
        port: 993,
        user: 'not-an-email',
        password: 'password123',
      };

      const result = ImapConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const config = {
        host: 'imap.gmail.com',
      };

      const result = ImapConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid port number', () => {
      const config = {
        host: 'imap.gmail.com',
        port: 99999,
        user: 'test@gmail.com',
        password: 'password123',
      };

      const result = ImapConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should handle custom port', () => {
      const config = {
        host: 'imap.custom.com',
        port: 143,
        user: 'test@custom.com',
        password: 'password123',
        tls: false,
      };

      const result = ImapConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.port).toBe(143);
        expect(result.data.tls).toBe(false);
      }
    });
  });

  describe('ImapClient constructor', () => {
    it('should create client with valid config', () => {
      const config = {
        host: 'imap.gmail.com',
        port: 993,
        user: 'test@gmail.com',
        password: 'password123',
        tls: true,
      };

      expect(() => new ImapClient(config, 'test-id')).not.toThrow();
    });

    it('should throw on invalid config', () => {
      const config = {
        host: 'imap.gmail.com',
        port: 'invalid' as any,
        user: 'test@gmail.com',
        password: 'password123',
      };

      expect(() => new ImapClient(config, 'test-id')).toThrow();
    });
  });

  // Note: Real IMAP connection tests require an actual IMAP server
  // In a real-world scenario, you would either:
  // 1. Use a test IMAP server (like MailHog or similar)
  // 2. Mock the imap-simple library
  // 3. Use integration tests with real accounts in CI/CD

  describe('IMAP connection (mocked)', () => {
    it('should handle connection failure gracefully', async () => {
      const config = {
        host: 'nonexistent.imap.server.invalid',
        port: 993,
        user: 'test@test.com',
        password: 'wrongpassword',
        tls: true,
        authTimeout: 1000,
      };

      const client = new ImapClient(config, 'test-fail');

      // Connection should fail for nonexistent server
      await expect(client.connect()).rejects.toThrow();
    });
  });
});
