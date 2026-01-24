import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getEmails } from "@/app/api/emails/route";
import { POST as composeEmail } from "@/app/api/emails/compose/route";
import { GET as searchEmails } from "@/app/api/emails/search/route";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: "user-123" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => ({
        data: {
          id: "conn-123",
          access_token: "encrypted-token",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
        error: null,
      })),
    })),
  })),
}));

vi.mock("@/lib/email/graph-service", () => ({
  GraphEmailService: {
    fromConnection: vi.fn(() => ({
      getEmails: vi.fn(() => ({
        emails: [
          {
            id: "1",
            subject: "Test Email",
            from: { emailAddress: { name: "John", address: "john@test.com" } },
            receivedDateTime: "2024-01-01T00:00:00Z",
          },
        ],
        nextLink: null,
      })),
      searchEmails: vi.fn(() => ({
        emails: [],
        nextLink: null,
      })),
      sendEmail: vi.fn(),
    })),
  },
}));

describe("Email API Routes", () => {
  describe("GET /api/emails", () => {
    it("should return emails from inbox", async () => {
      const request = new NextRequest("http://localhost:3000/api/emails?folder=inbox");
      const response = await getEmails(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.emails).toBeDefined();
      expect(data.folder).toBe("inbox");
    });

    it("should require authentication", async () => {
      // Mock unauthenticated user
      vi.mocked(await import("@/lib/supabase/server")).createClient = vi.fn(() => ({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: null },
            error: "Not authenticated",
          })),
        },
      })) as any;

      const request = new NextRequest("http://localhost:3000/api/emails");
      const response = await getEmails(request);

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/emails/compose", () => {
    it("should send email with valid data", async () => {
      const request = new NextRequest("http://localhost:3000/api/emails/compose", {
        method: "POST",
        body: JSON.stringify({
          to: [{ name: "Jane", address: "jane@test.com" }],
          subject: "Test Subject",
          body: "Test body",
          bodyType: "html",
        }),
      });

      const response = await composeEmail(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should reject invalid email data", async () => {
      const request = new NextRequest("http://localhost:3000/api/emails/compose", {
        method: "POST",
        body: JSON.stringify({
          to: [], // Missing recipients
          subject: "Test",
          body: "Test",
        }),
      });

      const response = await composeEmail(request);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/emails/search", () => {
    it("should search emails by query", async () => {
      const request = new NextRequest("http://localhost:3000/api/emails/search?q=tax");
      const response = await searchEmails(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.query).toBe("tax");
      expect(data.emails).toBeDefined();
    });

    it("should require search query", async () => {
      const request = new NextRequest("http://localhost:3000/api/emails/search");
      const response = await searchEmails(request);

      expect(response.status).toBe(400);
    });
  });
});
