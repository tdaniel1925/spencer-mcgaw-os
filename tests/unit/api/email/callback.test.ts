import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/email/callback/route";
import { NextRequest, NextResponse } from "next/server";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: "test-user-id" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({ error: null })),
    })),
  })),
}));

vi.mock("@/lib/shared/crypto", () => ({
  encrypt: vi.fn((value) => `encrypted_${value}`),
  decrypt: vi.fn((value) => value.replace("encrypted_", "")),
}));

// Mock fetch
global.fetch = vi.fn();

describe("GET /api/email/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MS_GRAPH_CLIENT_ID = "test-client-id";
    process.env.MS_GRAPH_CLIENT_SECRET = "test-client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("should handle admin_consent_required error with helpful message", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/email/callback?error=admin_consent_required&error_description=AADSTS65004&state=test-state"
    );
    request.cookies.set("oauth_state", "test-state");

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("error=");
    expect(decodeURIComponent(location || "")).toContain("organization requires admin approval");
  });

  it("should handle user cancelled consent gracefully", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/email/callback?error=access_denied&error_description=user%20cancelled&state=test-state"
    );
    request.cookies.set("oauth_state", "test-state");

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(decodeURIComponent(location || "")).toContain("cancelled the sign-in process");
  });

  it("should handle interaction_required error (MFA)", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/email/callback?error=interaction_required&error_description=AADSTS50076&state=test-state"
    );
    request.cookies.set("oauth_state", "test-state");

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(decodeURIComponent(location || "")).toContain("Additional authentication required");
  });

  it("should reject requests with invalid state (CSRF protection)", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/email/callback?code=test-code&state=wrong-state"
    );
    request.cookies.set("oauth_state", "correct-state");

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("Invalid%20state%20parameter");
  });

  it("should handle successful OAuth flow", async () => {
    // Mock successful token exchange
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
      }),
    });

    // Mock successful user info fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mail: "user@example.com",
        userPrincipalName: "user@example.com",
      }),
    });

    // Mock background sync trigger
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/email/callback?code=test-code&state=test-state"
    );
    request.cookies.set("oauth_state", "test-state");

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/email-client");
    expect(location).toContain("success=Email%20connected%20successfully");
  });

  it("should handle invalid_grant token error with helpful message", async () => {
    // Mock failed token exchange
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "invalid_grant",
        error_description: "The authorization code has expired",
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/email/callback?code=test-code&state=test-state"
    );
    request.cookies.set("oauth_state", "test-state");

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(decodeURIComponent(location || "")).toContain("authorization code has expired");
  });

  it("should handle AADSTS65001 (admin consent required during token exchange)", async () => {
    // Mock failed token exchange
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "unauthorized_client",
        error_description: "AADSTS65001: The user or administrator has not consented",
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/email/callback?code=test-code&state=test-state"
    );
    request.cookies.set("oauth_state", "test-state");

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(decodeURIComponent(location || "")).toContain("organization requires admin consent");
  });
});
