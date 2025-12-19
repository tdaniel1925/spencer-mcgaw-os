import { describe, it, expect } from "vitest";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_COMPANY_NAME,
  API_VERSION,
} from "@/lib/constants";

describe("constants", () => {
  describe("DEFAULT_ORGANIZATION_ID", () => {
    it("should be a valid UUID format", () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(DEFAULT_ORGANIZATION_ID).toMatch(uuidRegex);
    });

    it("should be defined", () => {
      expect(DEFAULT_ORGANIZATION_ID).toBeDefined();
    });
  });

  describe("DEFAULT_COMPANY_NAME", () => {
    it("should be Spencer McGaw CPA", () => {
      expect(DEFAULT_COMPANY_NAME).toBe("Spencer McGaw CPA");
    });

    it("should be a non-empty string", () => {
      expect(DEFAULT_COMPANY_NAME.length).toBeGreaterThan(0);
    });
  });

  describe("API_VERSION", () => {
    it("should be v1", () => {
      expect(API_VERSION).toBe("v1");
    });

    it("should start with v", () => {
      expect(API_VERSION).toMatch(/^v\d+$/);
    });
  });
});
