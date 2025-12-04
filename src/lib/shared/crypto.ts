// Simple encryption utilities for sensitive data
// In production, use a proper key management service (AWS KMS, HashiCorp Vault, etc.)

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-key-change-in-production";

/**
 * Simple XOR-based obfuscation for demo purposes
 * In production, use proper AES-256-GCM encryption
 */
export function encrypt(text: string): string {
  if (!text) return text;

  // In production, use crypto.createCipheriv with AES-256-GCM
  // This is a simple Base64 encoding for demo - NOT SECURE FOR PRODUCTION
  const buffer = Buffer.from(text, "utf-8");
  const encoded = buffer.toString("base64");
  return `enc:${encoded}`;
}

/**
 * Decrypt obfuscated text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  // Check if it's encrypted
  if (!encryptedText.startsWith("enc:")) {
    return encryptedText; // Return as-is if not encrypted (backwards compatibility)
  }

  const encoded = encryptedText.slice(4);
  const buffer = Buffer.from(encoded, "base64");
  return buffer.toString("utf-8");
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith("enc:") ?? false;
}
