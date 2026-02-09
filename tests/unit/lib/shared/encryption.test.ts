/**
 * Encryption Utilities Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, hash, generateToken, secureCompare } from '@/lib/shared/encryption';

describe('Encryption Utilities', () => {
  beforeAll(() => {
    // Set encryption key for testing
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex
    }
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const plaintext = 'my secret password';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'same text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // Different IVs mean different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same plaintext
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should encrypt unicode characters correctly', () => {
      const plaintext = 'Hello 世界 🌍';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt long strings correctly', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string encryption', () => {
      expect(() => encrypt('')).toThrow('Cannot encrypt empty string');
    });

    it('should throw error when decrypting invalid ciphertext', () => {
      expect(() => decrypt('invalid')).toThrow();
    });

    it('should throw error when decrypting with wrong format', () => {
      expect(() => decrypt('aa:bb:cc')).toThrow('Invalid ciphertext format');
    });

    it('should throw error when decrypting tampered data', () => {
      const plaintext = 'secret';
      const encrypted = encrypt(plaintext);

      // Tamper with the ciphertext
      const parts = encrypted.split(':');
      parts[3] = 'deadbeef';
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should produce ciphertext in correct format (iv:authTag:salt:ciphertext)', () => {
      const plaintext = 'test';
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(4);
      expect(parts[0]).toHaveLength(32); // IV (16 bytes in hex)
      expect(parts[1]).toHaveLength(32); // Auth tag (16 bytes in hex)
      expect(parts[2]).toHaveLength(128); // Salt (64 bytes in hex)
      expect(parts[3].length).toBeGreaterThan(0); // Ciphertext
    });
  });

  describe('hash', () => {
    it('should produce consistent SHA-256 hash', () => {
      const data = 'test string';
      const hash1 = hash(data);
      const hash2 = hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 32 bytes (64 hex chars)
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hash('string1');
      const hash2 = hash('string2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const result = hash('');
      expect(result).toHaveLength(64);
    });
  });

  describe('generateToken', () => {
    it('should generate random token of default length', () => {
      const token = generateToken();

      expect(token).toHaveLength(64); // 32 bytes in hex
    });

    it('should generate random token of custom length', () => {
      const token = generateToken(16);

      expect(token).toHaveLength(32); // 16 bytes in hex
    });

    it('should generate different tokens each time', () => {
      const token1 = generateToken();
      const token2 = generateToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate only hex characters', () => {
      const token = generateToken();
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });
  });

  describe('secureCompare', () => {
    it('should return true for identical strings', () => {
      const str = 'test123';
      expect(secureCompare(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('test1', 'test2')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(secureCompare('short', 'longer string')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(secureCompare('', '')).toBe(true);
      expect(secureCompare('', 'nonempty')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(secureCompare('Test', 'test')).toBe(false);
    });
  });
});
