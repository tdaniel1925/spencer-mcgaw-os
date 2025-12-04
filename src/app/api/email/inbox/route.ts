import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// Helper to refresh access token if expired
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const folder = searchParams.get("folder") || "inbox";
  const top = searchParams.get("top") || "50";
  const skip = searchParams.get("skip") || "0";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get email connection
  const { data: connection, error: connError } = await supabase
    .from("email_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .single();

  if (connError || !connection) {
    return NextResponse.json(
      { error: "Email not connected", needsConnection: true },
      { status: 400 }
    );
  }

  let accessToken = connection.access_token;

  // Check if token is expired
  if (new Date(connection.expires_at) <= new Date()) {
    const newTokens = await refreshAccessToken(connection.refresh_token);
    if (!newTokens) {
      return NextResponse.json(
        { error: "Token expired, please reconnect", needsConnection: true },
        { status: 401 }
      );
    }

    // Update tokens in database
    accessToken = newTokens.access_token;
    await supabase
      .from("email_connections")
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
  }

  try {
    // Map folder name to Graph API folder
    const folderMap: Record<string, string> = {
      inbox: "inbox",
      sent: "sentitems",
      drafts: "drafts",
      trash: "deleteditems",
      archive: "archive",
    };

    const graphFolder = folderMap[folder] || "inbox";

    // Fetch emails from Microsoft Graph
    const response = await fetch(
      `${MICROSOFT_GRAPH_URL}/me/mailFolders/${graphFolder}/messages?$top=${top}&$skip=${skip}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead,hasAttachments,importance,flag`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Graph API error:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform to our email format
    const emails = data.value.map((email: any) => ({
      id: email.id,
      from: {
        name: email.from?.emailAddress?.name || "Unknown",
        email: email.from?.emailAddress?.address || "",
      },
      to: email.toRecipients?.map((r: any) => ({
        name: r.emailAddress?.name || "",
        email: r.emailAddress?.address || "",
      })) || [],
      subject: email.subject || "(No Subject)",
      preview: email.bodyPreview || "",
      body: email.body?.content || "",
      bodyType: email.body?.contentType || "text",
      date: new Date(email.receivedDateTime),
      isRead: email.isRead,
      hasAttachments: email.hasAttachments,
      importance: email.importance,
      isStarred: email.flag?.flagStatus === "flagged",
      folder,
    }));

    return NextResponse.json({
      emails,
      nextLink: data["@odata.nextLink"],
      count: data["@odata.count"],
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
