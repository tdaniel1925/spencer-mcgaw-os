import { NextRequest, NextResponse } from "next/server";
import { getWelcomeEmailPreview } from "@/lib/email/email-service";
import { getApiUser } from "@/lib/auth/api-rbac";

/**
 * GET /api/admin/email-preview?type=welcome
 * Returns HTML preview of email templates (admin only)
 */
export async function GET(request: NextRequest) {
  // Admin only
  const apiUser = await getApiUser();
  if (!apiUser || apiUser.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "welcome";

  if (type === "welcome") {
    const result = getWelcomeEmailPreview(
      "Test User",
      "test@example.com",
      "TempPassword123!"
    );

    return new NextResponse(result.html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
}
