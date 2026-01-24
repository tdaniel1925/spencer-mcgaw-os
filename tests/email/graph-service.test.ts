import { describe, it, expect, beforeEach, vi } from "vitest";
import { GraphEmailService, GraphServiceError } from "@/lib/email/graph-service";

// Mock fetch globally
global.fetch = vi.fn();

describe("GraphEmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEmails", () => {
    it("should fetch emails from inbox", async () => {
      const mockEmails = [
        {
          id: "1",
          subject: "Test Email",
          from: { emailAddress: { name: "John Doe", address: "john@example.com" } },
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: mockEmails }),
      });

      const service = new GraphEmailService("test-token");
      const result = await service.getEmails("inbox");

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].subject).toBe("Test Email");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/me/mailFolders/inbox/messages"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should handle API errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: "InvalidAuthenticationToken",
            message: "Access token is invalid",
          },
        }),
      });

      const service = new GraphEmailService("invalid-token");

      await expect(service.getEmails("inbox")).rejects.toThrow(GraphServiceError);
    });
  });

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new GraphEmailService("test-token");

      await expect(
        service.sendEmail({
          subject: "Test",
          body: "Hello",
          to: [{ name: "Jane", address: "jane@example.com" }],
        })
      ).resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/me/sendMail"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Test"),
        })
      );
    });

    it("should reject invalid recipients", async () => {
      const service = new GraphEmailService("test-token");

      await expect(
        service.sendEmail({
          subject: "Test",
          body: "Hello",
          to: [], // Empty recipients
        })
      ).rejects.toThrow();
    });
  });

  describe("markAsRead", () => {
    it("should mark email as read", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const service = new GraphEmailService("test-token");
      await service.markAsRead("email-123", true);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/me/messages/email-123"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ isRead: true }),
        })
      );
    });
  });

  describe("searchEmails", () => {
    it("should search emails by query", async () => {
      const mockResults = [
        {
          id: "1",
          subject: "Tax documents",
          from: { emailAddress: { name: "Client", address: "client@example.com" } },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: mockResults }),
      });

      const service = new GraphEmailService("test-token");
      const result = await service.searchEmails({ query: "tax" });

      expect(result.emails).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('$search="tax"'),
        expect.any(Object)
      );
    });
  });

  describe("getConversationEmails", () => {
    it("should fetch all emails in a thread", async () => {
      const mockThread = [
        { id: "1", subject: "Re: Question", conversationId: "conv-123" },
        { id: "2", subject: "Re: Question", conversationId: "conv-123" },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: mockThread }),
      });

      const service = new GraphEmailService("test-token");
      const result = await service.getConversationEmails("conv-123");

      expect(result).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("conversationId eq 'conv-123'"),
        expect.any(Object)
      );
    });
  });
});
