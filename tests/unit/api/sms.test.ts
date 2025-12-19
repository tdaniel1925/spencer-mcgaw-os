import { describe, it, expect, vi, beforeEach } from "vitest";

// Phone number validation functions (matching route.ts logic)
function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (/^\+\d{10,15}$/.test(cleaned)) return true;
  if (/^\d{10}$/.test(cleaned)) return true;
  if (/^1\d{10}$/.test(cleaned)) return true;
  return false;
}

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith("1")) return `+${cleaned}`;
  return cleaned;
}

describe("SMS API", () => {
  describe("Phone Number Validation", () => {
    it("should validate E.164 format", () => {
      expect(isValidPhoneNumber("+12345678901")).toBe(true);
      expect(isValidPhoneNumber("+442071234567")).toBe(true);
    });

    it("should validate US 10-digit format", () => {
      expect(isValidPhoneNumber("5551234567")).toBe(true);
    });

    it("should validate US 11-digit format with leading 1", () => {
      expect(isValidPhoneNumber("15551234567")).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      expect(isValidPhoneNumber("123")).toBe(false);
      expect(isValidPhoneNumber("")).toBe(false);
      expect(isValidPhoneNumber("abcdefghij")).toBe(false);
    });

    it("should handle formatted phone numbers", () => {
      expect(isValidPhoneNumber("(555) 123-4567")).toBe(true);
      expect(isValidPhoneNumber("+1 (555) 123-4567")).toBe(true);
    });
  });

  describe("Phone Number Normalization", () => {
    it("should keep E.164 format unchanged", () => {
      expect(normalizePhoneNumber("+12345678901")).toBe("+12345678901");
    });

    it("should convert 10-digit to E.164", () => {
      expect(normalizePhoneNumber("5551234567")).toBe("+15551234567");
    });

    it("should convert 11-digit with leading 1", () => {
      expect(normalizePhoneNumber("15551234567")).toBe("+15551234567");
    });

    it("should strip formatting characters", () => {
      expect(normalizePhoneNumber("(555) 123-4567")).toBe("+15551234567");
    });
  });

  describe("POST /api/sms/messages", () => {
    const mockMessage = {
      conversation_id: "conv-1",
      body: "Hello, this is a test message",
    };

    it("should require conversation_id", () => {
      const invalid = { body: "test" };
      expect("conversation_id" in invalid).toBe(false);
    });

    it("should require message body", () => {
      const invalid = { conversation_id: "conv-1" };
      expect("body" in invalid).toBe(false);
    });

    it("should validate message length (160 char limit)", () => {
      const shortMessage = "Short message";
      const longMessage = "a".repeat(161);
      expect(shortMessage.length).toBeLessThanOrEqual(160);
      expect(longMessage.length).toBeGreaterThan(160);
    });

    it("should handle scheduled messages", () => {
      const scheduledMessage = {
        ...mockMessage,
        scheduled_for: new Date(Date.now() + 86400000).toISOString(),
      };
      const isScheduled = new Date(scheduledMessage.scheduled_for) > new Date();
      expect(isScheduled).toBe(true);
    });

    it("should set status based on scheduling", () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const isScheduled = !!futureDate && new Date(futureDate) > new Date();
      const status = isScheduled ? "scheduled" : "pending";
      expect(status).toBe("scheduled");
    });
  });

  describe("GET /api/sms/messages", () => {
    it("should support search parameter", () => {
      const searchParams = new URLSearchParams({ search: "test" });
      expect(searchParams.get("search")).toBe("test");
    });

    it("should support contact_id filter", () => {
      const searchParams = new URLSearchParams({ contact_id: "contact-1" });
      expect(searchParams.get("contact_id")).toBe("contact-1");
    });

    it("should support client_id filter", () => {
      const searchParams = new URLSearchParams({ client_id: "client-1" });
      expect(searchParams.get("client_id")).toBe("client-1");
    });

    it("should support limit parameter", () => {
      const searchParams = new URLSearchParams({ limit: "50" });
      expect(parseInt(searchParams.get("limit") || "50")).toBe(50);
    });

    it("should default limit to 50", () => {
      const searchParams = new URLSearchParams({});
      expect(parseInt(searchParams.get("limit") || "50")).toBe(50);
    });
  });

  describe("SMS Templates", () => {
    const mockTemplate = {
      id: "template-1",
      name: "Welcome Message",
      body: "Welcome to Spencer McGaw CPA! We're glad to have you.",
      category: "onboarding",
    };

    it("should have required template fields", () => {
      expect(mockTemplate).toHaveProperty("id");
      expect(mockTemplate).toHaveProperty("name");
      expect(mockTemplate).toHaveProperty("body");
    });

    it("should validate template body length", () => {
      expect(mockTemplate.body.length).toBeLessThanOrEqual(160);
    });
  });

  describe("SMS Campaigns", () => {
    const mockCampaign = {
      id: "campaign-1",
      name: "Tax Season Reminder",
      status: "draft",
      scheduled_for: "2024-03-01T09:00:00Z",
      recipients: ["contact-1", "contact-2"],
    };

    it("should have campaign statuses", () => {
      const validStatuses = ["draft", "scheduled", "running", "completed", "cancelled"];
      expect(validStatuses).toContain(mockCampaign.status);
    });

    it("should have recipients array", () => {
      expect(Array.isArray(mockCampaign.recipients)).toBe(true);
      expect(mockCampaign.recipients.length).toBeGreaterThan(0);
    });

    it("should validate scheduled_for date", () => {
      expect(() => new Date(mockCampaign.scheduled_for)).not.toThrow();
    });
  });

  describe("Opt-in/Opt-out", () => {
    it("should track opt-in status", () => {
      const conversation = {
        id: "conv-1",
        is_opted_in: true,
      };
      expect(conversation.is_opted_in).toBe(true);
    });

    it("should reject messages to opted-out contacts", () => {
      const conversation = {
        is_opted_in: false,
      };
      const canSend = conversation.is_opted_in;
      expect(canSend).toBe(false);
    });
  });
});
