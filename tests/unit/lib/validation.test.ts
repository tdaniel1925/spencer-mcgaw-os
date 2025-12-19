import { describe, it, expect } from "vitest";
import {
  validate,
  sanitizeString,
  sanitizeODataFilter,
  isValidId,
  sanitizeIds,
  type ValidationSchema,
} from "@/lib/shared/validation";

describe("validation", () => {
  describe("validate", () => {
    it("should pass validation for valid data", () => {
      const schema: ValidationSchema = {
        name: { required: true, type: "string" },
        email: { required: true, type: "email" },
      };
      const result = validate({ name: "John", email: "john@example.com" }, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for missing required field", () => {
      const schema: ValidationSchema = {
        name: { required: true, type: "string" },
      };
      const result = validate({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("name is required");
    });

    it("should fail validation for empty required field", () => {
      const schema: ValidationSchema = {
        name: { required: true, type: "string" },
      };
      const result = validate({ name: "" }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("name is required");
    });

    it("should pass validation for optional empty field", () => {
      const schema: ValidationSchema = {
        name: { type: "string" },
      };
      const result = validate({ name: "" }, schema);
      expect(result.valid).toBe(true);
    });

    it("should validate string type", () => {
      const schema: ValidationSchema = {
        name: { type: "string" },
      };
      const result = validate({ name: 123 }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("name must be a string");
    });

    it("should validate number type", () => {
      const schema: ValidationSchema = {
        age: { type: "number" },
      };
      expect(validate({ age: 25 }, schema).valid).toBe(true);
      expect(validate({ age: "25" }, schema).valid).toBe(false);
      expect(validate({ age: NaN }, schema).valid).toBe(false);
    });

    it("should validate boolean type", () => {
      const schema: ValidationSchema = {
        active: { type: "boolean" },
      };
      expect(validate({ active: true }, schema).valid).toBe(true);
      expect(validate({ active: false }, schema).valid).toBe(true);
      expect(validate({ active: "true" }, schema).valid).toBe(false);
    });

    it("should validate email type", () => {
      const schema: ValidationSchema = {
        email: { type: "email" },
      };
      expect(validate({ email: "test@example.com" }, schema).valid).toBe(true);
      expect(validate({ email: "invalid-email" }, schema).valid).toBe(false);
      expect(validate({ email: "test@" }, schema).valid).toBe(false);
      expect(validate({ email: "@example.com" }, schema).valid).toBe(false);
    });

    it("should validate phone type", () => {
      const schema: ValidationSchema = {
        phone: { type: "phone" },
      };
      expect(validate({ phone: "1234567890" }, schema).valid).toBe(true);
      expect(validate({ phone: "+1 (555) 123-4567" }, schema).valid).toBe(true);
      expect(validate({ phone: "123" }, schema).valid).toBe(false);
    });

    it("should validate url type", () => {
      const schema: ValidationSchema = {
        website: { type: "url" },
      };
      expect(validate({ website: "https://example.com" }, schema).valid).toBe(true);
      expect(validate({ website: "http://localhost:3000" }, schema).valid).toBe(true);
      expect(validate({ website: "not-a-url" }, schema).valid).toBe(false);
    });

    it("should validate uuid type", () => {
      const schema: ValidationSchema = {
        id: { type: "uuid" },
      };
      expect(validate({ id: "550e8400-e29b-41d4-a716-446655440000" }, schema).valid).toBe(true);
      expect(validate({ id: "not-a-uuid" }, schema).valid).toBe(false);
    });

    it("should validate minLength", () => {
      const schema: ValidationSchema = {
        password: { type: "string", minLength: 8 },
      };
      expect(validate({ password: "12345678" }, schema).valid).toBe(true);
      expect(validate({ password: "1234567" }, schema).valid).toBe(false);
    });

    it("should validate maxLength", () => {
      const schema: ValidationSchema = {
        username: { type: "string", maxLength: 20 },
      };
      expect(validate({ username: "short" }, schema).valid).toBe(true);
      expect(validate({ username: "a".repeat(21) }, schema).valid).toBe(false);
    });

    it("should validate min number", () => {
      const schema: ValidationSchema = {
        age: { type: "number", min: 0 },
      };
      expect(validate({ age: 0 }, schema).valid).toBe(true);
      expect(validate({ age: -1 }, schema).valid).toBe(false);
    });

    it("should validate max number", () => {
      const schema: ValidationSchema = {
        rating: { type: "number", max: 5 },
      };
      expect(validate({ rating: 5 }, schema).valid).toBe(true);
      expect(validate({ rating: 6 }, schema).valid).toBe(false);
    });

    it("should validate custom pattern", () => {
      const schema: ValidationSchema = {
        code: { type: "string", pattern: /^[A-Z]{3}\d{3}$/ },
      };
      expect(validate({ code: "ABC123" }, schema).valid).toBe(true);
      expect(validate({ code: "abc123" }, schema).valid).toBe(false);
      expect(validate({ code: "ABCD1234" }, schema).valid).toBe(false);
    });

    it("should validate custom function", () => {
      const schema: ValidationSchema = {
        password: {
          type: "string",
          custom: (value) => {
            const str = value as string;
            if (!/[A-Z]/.test(str)) return "Password must contain uppercase";
            if (!/[0-9]/.test(str)) return "Password must contain number";
            return null;
          },
        },
      };
      expect(validate({ password: "Password1" }, schema).valid).toBe(true);
      const result = validate({ password: "password1" }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Password must contain uppercase");
    });

    it("should collect multiple errors", () => {
      const schema: ValidationSchema = {
        name: { required: true },
        email: { required: true, type: "email" },
        age: { required: true, type: "number" },
      };
      const result = validate({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe("sanitizeString", () => {
    it("should remove angle brackets", () => {
      // sanitizeString removes < and > and escapes single quotes
      expect(sanitizeString("<script>alert('xss')</script>")).toBe("scriptalert(''xss'')/script");
    });

    it("should escape single quotes", () => {
      expect(sanitizeString("O'Brien")).toBe("O''Brien");
    });

    it("should trim whitespace", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });

    it("should handle non-string input", () => {
      expect(sanitizeString(123 as unknown as string)).toBe("");
      expect(sanitizeString(null as unknown as string)).toBe("");
    });

    it("should handle empty string", () => {
      expect(sanitizeString("")).toBe("");
    });
  });

  describe("sanitizeODataFilter", () => {
    it("should remove quotes", () => {
      expect(sanitizeODataFilter("test'value\"")).toBe("testvalue");
    });

    it("should remove parentheses", () => {
      expect(sanitizeODataFilter("test(value)")).toBe("testvalue");
    });

    it("should remove dollar signs", () => {
      expect(sanitizeODataFilter("$filter")).toBe("filter");
    });

    it("should remove logical operators", () => {
      expect(sanitizeODataFilter("a&b|c;d")).toBe("abcd");
    });

    it("should trim and limit length", () => {
      const longString = "a".repeat(200);
      expect(sanitizeODataFilter(longString).length).toBe(100);
    });

    it("should handle non-string input", () => {
      expect(sanitizeODataFilter(123 as unknown as string)).toBe("");
    });
  });

  describe("isValidId", () => {
    it("should return true for valid alphanumeric IDs", () => {
      expect(isValidId("abc123")).toBe(true);
      expect(isValidId("user-id")).toBe(true);
      expect(isValidId("user_id")).toBe(true);
    });

    it("should return false for invalid characters", () => {
      expect(isValidId("user@id")).toBe(false);
      expect(isValidId("user id")).toBe(false);
      expect(isValidId("user/id")).toBe(false);
    });

    it("should return false for too long IDs", () => {
      expect(isValidId("a".repeat(101))).toBe(false);
    });

    it("should return true for max length ID", () => {
      expect(isValidId("a".repeat(100))).toBe(true);
    });

    it("should return false for non-string input", () => {
      expect(isValidId(123 as unknown as string)).toBe(false);
    });
  });

  describe("sanitizeIds", () => {
    it("should filter valid IDs", () => {
      const result = sanitizeIds(["valid-id", "another_id", "bad@id"]);
      expect(result).toEqual(["valid-id", "another_id"]);
    });

    it("should handle non-string elements", () => {
      const result = sanitizeIds(["valid", 123, null, "also-valid"]);
      expect(result).toEqual(["valid", "also-valid"]);
    });

    it("should limit to 100 IDs", () => {
      const manyIds = Array.from({ length: 150 }, (_, i) => `id-${i}`);
      const result = sanitizeIds(manyIds);
      expect(result.length).toBe(100);
    });

    it("should return empty array for non-array input", () => {
      expect(sanitizeIds("not-array" as unknown as unknown[])).toEqual([]);
    });

    it("should return empty array for empty input", () => {
      expect(sanitizeIds([])).toEqual([]);
    });
  });
});
