import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// Common public email domains to skip (we don't want to whitelist gmail.com, etc.)
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "tutanota.com",
]);

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

// Scan sent emails and whitelist recipient domains
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get all email connections for this user
    const { data: connections, error: connError } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "microsoft");

    if (connError || !connections || connections.length === 0) {
      return NextResponse.json(
        { error: "No email accounts connected" },
        { status: 400 }
      );
    }

    const allRecipientDomains = new Set<string>();
    const allRecipientEmails = new Set<string>();

    // Process each connected account
    for (const connection of connections) {
      let accessToken = connection.access_token;

      // Check if token is expired
      if (new Date(connection.expires_at) <= new Date()) {
        const newTokens = await refreshAccessToken(connection.refresh_token);
        if (!newTokens) {
          console.error(`Token refresh failed for connection ${connection.id}`);
          continue;
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

      // Fetch sent emails (get up to 500 to cover good history)
      let currentUrl: string | null = `${MICROSOFT_GRAPH_URL}/me/mailFolders/sentitems/messages?$top=100&$select=toRecipients,ccRecipients,bccRecipients`;
      let pageCount = 0;
      const maxPages = 5; // 500 emails max

      while (currentUrl && pageCount < maxPages) {
        const graphResponse: Response = await fetch(currentUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!graphResponse.ok) {
          console.error(`Failed to fetch sent emails: ${graphResponse.status}`);
          break;
        }

        const data = await graphResponse.json();

        // Extract recipient email addresses and domains
        for (const email of data.value || []) {
          const allRecipients = [
            ...(email.toRecipients || []),
            ...(email.ccRecipients || []),
            ...(email.bccRecipients || []),
          ];

          for (const recipient of allRecipients) {
            const emailAddress = recipient.emailAddress?.address?.toLowerCase();
            if (emailAddress && emailAddress.includes("@")) {
              allRecipientEmails.add(emailAddress);
              const domain = emailAddress.split("@")[1];
              if (domain && !PUBLIC_EMAIL_DOMAINS.has(domain)) {
                allRecipientDomains.add(domain);
              }
            }
          }
        }

        currentUrl = data["@odata.nextLink"] || null;
        pageCount++;
      }
    }

    // Get existing whitelist rules to avoid duplicates
    const { data: existingRules } = await supabase
      .from("email_sender_rules")
      .select("match_value, rule_type, action")
      .eq("is_active", true);

    const existingWhitelistedDomains = new Set(
      (existingRules || [])
        .filter((r) => r.rule_type === "domain" && r.action === "whitelist")
        .map((r) => r.match_value.toLowerCase())
    );

    const existingWhitelistedEmails = new Set(
      (existingRules || [])
        .filter((r) => r.rule_type === "email" && r.action === "whitelist")
        .map((r) => r.match_value.toLowerCase())
    );

    // Filter out already whitelisted domains
    const newDomains = Array.from(allRecipientDomains).filter(
      (domain) => !existingWhitelistedDomains.has(domain)
    );

    // Create whitelist rules for new domains
    const rulesToInsert = newDomains.map((domain) => ({
      created_by: user.id,
      rule_type: "domain",
      match_type: "exact",
      match_value: domain,
      action: "whitelist",
      reason: "Auto-whitelisted from sent emails",
      is_active: true,
    }));

    let insertedCount = 0;
    if (rulesToInsert.length > 0) {
      // Insert in batches to avoid issues
      const batchSize = 50;
      for (let i = 0; i < rulesToInsert.length; i += batchSize) {
        const batch = rulesToInsert.slice(i, i + batchSize);
        const { error: insertError, data: insertedData } = await supabase
          .from("email_sender_rules")
          .insert(batch)
          .select();

        if (insertError) {
          console.error("Error inserting whitelist rules:", insertError);
        } else {
          insertedCount += insertedData?.length || 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalRecipientsFound: allRecipientEmails.size,
        uniqueDomainsFound: allRecipientDomains.size,
        alreadyWhitelisted: allRecipientDomains.size - newDomains.length,
        newDomainsWhitelisted: insertedCount,
        skippedPublicDomains: Array.from(allRecipientEmails)
          .filter((e) => PUBLIC_EMAIL_DOMAINS.has(e.split("@")[1]))
          .length,
      },
      newDomains: newDomains.slice(0, 50), // Return first 50 for display
    });
  } catch (error) {
    console.error("Train from sent error:", error);
    return NextResponse.json(
      { error: "Failed to process sent emails" },
      { status: 500 }
    );
  }
}

// Get training status/stats
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get count of auto-whitelisted domains
    const { data: rules, error } = await supabase
      .from("email_sender_rules")
      .select("*")
      .eq("is_active", true)
      .eq("action", "whitelist")
      .eq("reason", "Auto-whitelisted from sent emails");

    if (error) {
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    return NextResponse.json({
      autoWhitelistedCount: rules?.length || 0,
      domains: (rules || []).map((r) => r.match_value),
    });
  } catch (error) {
    console.error("Get training stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
