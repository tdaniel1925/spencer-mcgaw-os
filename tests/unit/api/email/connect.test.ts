import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/email/connect/route";
import { NextRequest } from "next/server";

describe("POST /api/email/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up required env vars
    process.env.MS_GRAPH_CLIENT_ID = "test-client-id";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("should redirect to Microsoft OAuth with select_account prompt by default", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/connect");

    const response = await GET(request);

    expect(response.status).toBe(307); // Temporary redirect
    const location = response.headers.get("location");
    expect(location).toContain("login.microsoftonline.com");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain("prompt=select_account"); // FIX: Changed from consent
    expect(location).toContain("scope=");
    expect(location).toContain("state=");

    // Should set oauth_state cookie
    const cookies = response.headers.get("set-cookie");
    expect(cookies).toContain("oauth_state=");
  });

  it("should use admin_consent prompt when admin=true query param is present", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/connect?admin=true");

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("prompt=admin_consent");
  });

  it("should return 500 if Microsoft client ID is not configured", async () => {
    delete process.env.MS_GRAPH_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_ID;

    const request = new NextRequest("http://localhost:3000/api/email/connect");

    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Microsoft OAuth not configured");
  });

  it("should include required OAuth scopes", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/connect");

    const response = await GET(request);

    const location = response.headers.get("location");
    expect(location).toContain("Mail.Read");
    expect(location).toContain("Mail.ReadWrite");
    expect(location).toContain("User.Read");
    expect(location).toContain("offline_access");
  });

  it("should use custom redirect URI from env if provided", async () => {
    process.env.MS_GRAPH_REDIRECT_URI = "https://custom.app/callback";

    const request = new NextRequest("http://localhost:3000/api/email/connect");

    const response = await GET(request);

    const location = response.headers.get("location");
    expect(location).toContain("redirect_uri=https%3A%2F%2Fcustom.app%2Fcallback");
  });
});
