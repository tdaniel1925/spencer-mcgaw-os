/**
 * Encryption Utilities
 *
 * Provides AES-256-GCM encryption/decryption for sensitive data.
 * Used for storing email passwords, API keys, and other secrets.
 *
 * SETUP REQUIRED:
 * Add ENCRYPTION_KEY to .env.local (32-byte hex string)
 * Generate with: openssl rand -hex 32
 */

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits authentication tag
const SALT_LENGTH = 64; // Additional randomness

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY is not set in environment variables. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // Ensure key is 32 bytes (256 bits)
  if (key.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be 32 bytes (64 hex characters). ' +
      'Generate with: openssl rand -hex 32'
    );
  }

  return Buffer.from(key, 'hex');
}

// ============================================================================
// ENCRYPTION FUNCTIONS
// ============================================================================

/**
 * Encrypt a string using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: iv:authTag:salt:ciphertext (all hex)
 */
export function encrypt(plaintext: string): string {
  try {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty string');
    }

    const key = getEncryptionKey();

    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine iv:authTag:salt:ciphertext
    const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${salt.toString('hex')}:${encrypted.toString('hex')}`;

    return combined;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt a string encrypted with encrypt()
 *
 * @param ciphertext - Encrypted string in format: iv:authTag:salt:ciphertext
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string): string {
  try {
    if (!ciphertext) {
      throw new Error('Cannot decrypt empty string');
    }

    const key = getEncryptionKey();

    // Split the combined string
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid ciphertext format');
    }

    const [ivHex, authTagHex, saltHex, encryptedHex] = parts;

    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid auth tag length');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Hash a string using SHA-256 (one-way)
 *
 * @param data - The string to hash
 * @returns Hex-encoded hash
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a random token (for API keys, etc.)
 *
 * @param length - Number of bytes (default: 32)
 * @returns Hex-encoded random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Compare two strings in constant time (prevents timing attacks)
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(a),
      Buffer.from(b)
    );
  } catch {
    // If lengths don't match, timingSafeEqual throws
    return false;
  }
}
