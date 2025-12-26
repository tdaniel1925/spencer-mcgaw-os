// Encryption utilities for sensitive data using AES-256-GCM
// For production, consider using AWS KMS, HashiCorp Vault, or similar key management service

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag

/**
 * Get or derive the encryption key from environment
 * Key must be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    console.warn(
      "WARNING: ENCRYPTION_KEY not set. Using derived key - NOT SECURE FOR PRODUCTION"
    );
    // Derive a key from a default string - ONLY FOR DEVELOPMENT
    return crypto.scryptSync("development-only-key", "salt", 32);
  }

  // If key is hex encoded (64 characters = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // If key is base64 encoded
  if (/^[A-Za-z0-9+/=]+$/.test(key) && key.length >= 32) {
    const decoded = Buffer.from(key, "base64");
    if (decoded.length >= 32) {
      return decoded.subarray(0, 32);
    }
  }

  // Derive a key from the string using scrypt
  return crypto.scryptSync(key, "spencer-mcgaw-salt", 32);
}

/**
 * Encrypt text using AES-256-GCM
 * Returns format: enc:v2:{iv}:{authTag}:{ciphertext} (all base64 encoded)
 */
export function encrypt(text: string): string {
  if (!text) return text;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    // Format: enc:v2:{iv}:{authTag}:{ciphertext}
    return `enc:v2:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt text encrypted with AES-256-GCM
 * Handles both v2 format and legacy base64 format for backwards compatibility
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  // Not encrypted - return as is
  if (!encryptedText.startsWith("enc:")) {
    return encryptedText;
  }

  try {
    // Check format version
    if (encryptedText.startsWith("enc:v2:")) {
      // v2 format: enc:v2:{iv}:{authTag}:{ciphertext}
      const parts = encryptedText.split(":");
      if (parts.length !== 5) {
        throw new Error("Invalid encrypted data format");
      }

      const [, , ivBase64, authTagBase64, ciphertext] = parts;

      const key = getEncryptionKey();
      const iv = Buffer.from(ivBase64, "base64");
      const authTag = Buffer.from(authTagBase64, "base64");

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, "base64", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } else {
      // Legacy v1 format: enc:{base64} (simple base64 encoding)
      const encoded = encryptedText.slice(4);
      const buffer = Buffer.from(encoded, "base64");
      return buffer.toString("utf-8");
    }
  } catch (error) {
    console.error("Decryption error:", error);
    // Return empty string on decryption failure to prevent data leaks
    throw new Error("Failed to decrypt data - key may have changed");
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith("enc:") ?? false;
}

/**
 * Check if value is using the latest encryption format
 */
export function isLatestFormat(value: string): boolean {
  return value?.startsWith("enc:v2:") ?? false;
}

/**
 * Re-encrypt a value if it's using legacy format
 */
export function upgradeEncryption(value: string): string {
  if (!value || !isEncrypted(value)) return value;

  // Already latest format
  if (isLatestFormat(value)) return value;

  // Decrypt with legacy format, re-encrypt with v2
  const decrypted = decrypt(value);
  return encrypt(decrypted);
}

/**
 * Generate a new 256-bit encryption key (hex encoded)
 * Use this to generate ENCRYPTION_KEY for .env
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash sensitive data for comparison (one-way)
 * Useful for tokens where you only need to verify, not retrieve
 */
export function hashForComparison(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
