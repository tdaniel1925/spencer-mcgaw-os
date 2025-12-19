import { describe, it, expect } from "vitest";
import { encrypt, decrypt, isEncrypted } from "@/lib/shared/crypto";

describe("crypto", () => {
  describe("encrypt", () => {
    it("should encrypt a string with enc: prefix", () => {
      const result = encrypt("hello");
      expect(result.startsWith("enc:")).toBe(true);
    });

    it("should produce base64 encoded content", () => {
      const result = encrypt("hello");
      const encoded = result.slice(4); // Remove "enc:" prefix
      expect(() => Buffer.from(encoded, "base64")).not.toThrow();
    });

    it("should return empty string for empty input", () => {
      expect(encrypt("")).toBe("");
    });

    it("should return falsy value for falsy input", () => {
      expect(encrypt(null as unknown as string)).toBeFalsy();
      expect(encrypt(undefined as unknown as string)).toBeFalsy();
    });

    it("should handle special characters", () => {
      const text = "Hello @World! #123 $%^&*()";
      const encrypted = encrypt(text);
      expect(encrypted.startsWith("enc:")).toBe(true);
    });

    it("should handle unicode characters", () => {
      const text = "Hello 世界 🌍";
      const encrypted = encrypt(text);
      expect(encrypted.startsWith("enc:")).toBe(true);
    });

    it("should produce different output for different input", () => {
      const enc1 = encrypt("hello");
      const enc2 = encrypt("world");
      expect(enc1).not.toBe(enc2);
    });
  });

  describe("decrypt", () => {
    it("should decrypt an encrypted string", () => {
      const original = "hello world";
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it("should return original string if not encrypted", () => {
      const plain = "not encrypted";
      expect(decrypt(plain)).toBe(plain);
    });

    it("should return empty string for empty input", () => {
      expect(decrypt("")).toBe("");
    });

    it("should return falsy value for falsy input", () => {
      expect(decrypt(null as unknown as string)).toBeFalsy();
      expect(decrypt(undefined as unknown as string)).toBeFalsy();
    });

    it("should handle special characters after decryption", () => {
      const original = "Test @#$%^&*() 123";
      const encrypted = encrypt(original);
      expect(decrypt(encrypted)).toBe(original);
    });

    it("should handle unicode after decryption", () => {
      const original = "日本語 中文 한국어 🎉";
      const encrypted = encrypt(original);
      expect(decrypt(encrypted)).toBe(original);
    });

    it("should round-trip multiple times", () => {
      const original = "test data";
      let result = encrypt(original);
      result = decrypt(result);
      expect(result).toBe(original);
    });
  });

  describe("isEncrypted", () => {
    it("should return true for encrypted strings", () => {
      const encrypted = encrypt("test");
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("should return false for plain strings", () => {
      expect(isEncrypted("plain text")).toBe(false);
    });

    it("should return false for strings starting with similar prefix", () => {
      expect(isEncrypted("encrypted:")).toBe(false);
      expect(isEncrypted("enc")).toBe(false);
    });

    it("should return true for strings with enc: prefix", () => {
      expect(isEncrypted("enc:anything")).toBe(true);
    });

    it("should return false for null/undefined", () => {
      expect(isEncrypted(null as unknown as string)).toBe(false);
      expect(isEncrypted(undefined as unknown as string)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isEncrypted("")).toBe(false);
    });
  });
});
