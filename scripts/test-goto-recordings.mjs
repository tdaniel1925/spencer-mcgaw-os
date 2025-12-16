/**
 * Test GoTo Connect Recording API access
 *
 * This script checks:
 * 1. If GoTo is connected
 * 2. If we have the right scopes
 * 3. If we can access recent call reports
 * 4. If recordings are available
 */

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "db.cyygkhwujcrbhzgjqipj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD || "ttandSellaBella1234",
  ssl: { rejectUnauthorized: false },
});

const GOTO_API_BASE = "https://api.goto.com";
const GOTO_AUTH_BASE = "https://authentication.logmeininc.com";

async function testGoToRecordings() {
  const client = await pool.connect();

  try {
    console.log("🔍 Checking GoTo Connect integration status...\n");

    // 1. Get integration status from database
    const result = await client.query(`
      SELECT
        is_connected,
        access_token,
        refresh_token,
        token_expires_at,
        account_key,
        channel_id,
        webhook_url,
        error_message
      FROM integrations
      WHERE provider = 'goto'
    `);

    if (result.rows.length === 0) {
      console.log("❌ No GoTo integration found in database");
      console.log("\n📋 Action needed: Run the GoTo OAuth flow first");
      return;
    }

    const integration = result.rows[0];
    console.log("📊 Integration Status:");
    console.log(`   Connected: ${integration.is_connected}`);
    console.log(`   Account Key: ${integration.account_key || "Not set"}`);
    console.log(`   Channel ID: ${integration.channel_id || "Not set"}`);
    console.log(`   Webhook URL: ${integration.webhook_url || "Not set"}`);
    console.log(`   Token Expires: ${integration.token_expires_at || "Unknown"}`);
    console.log(`   Error: ${integration.error_message || "None"}`);

    if (!integration.is_connected || !integration.access_token) {
      console.log("\n❌ GoTo is not connected");
      console.log("\n📋 Action needed: Re-authorize with GoTo Connect");
      console.log("\nReconnect URL:");
      console.log(getAuthUrl());
      return;
    }

    // Check if token is expired
    const tokenExpired = integration.token_expires_at
      ? new Date(integration.token_expires_at).getTime() < Date.now()
      : true;

    if (tokenExpired) {
      console.log("\n⚠️  Token is expired - attempting refresh...");

      try {
        const refreshed = await refreshToken(integration.refresh_token);
        integration.access_token = refreshed.access_token;
        console.log("✅ Token refreshed successfully");
      } catch (err) {
        console.log("❌ Token refresh failed:", err.message);
        console.log("\n📋 Action needed: Re-authorize with GoTo Connect");
        console.log("\nReconnect URL:");
        console.log(getAuthUrl());
        return;
      }
    }

    console.log("\n🔍 Testing API access...\n");

    // 2. Test call reports API
    console.log("📞 Fetching recent call reports...");
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const reports = await fetchCallReports(integration.access_token, integration.account_key, oneDayAgo);
      console.log(`   Found ${reports.length} call reports from last 24 hours`);

      if (reports.length === 0) {
        console.log("\n⚠️  No calls in the last 24 hours - try making a test call");
      } else {
        // Show first few calls
        console.log("\n   Recent calls:");
        for (const report of reports.slice(0, 3)) {
          console.log(`   - ${report.conversationSpaceId}`);
        }

        // 3. Get details on the most recent call
        console.log("\n📋 Fetching details for most recent call...");
        const callDetails = await fetchCallDetails(integration.access_token, reports[0].conversationSpaceId);
        console.log("   Call Details:");
        console.log(`   - Direction: ${callDetails.direction || "Unknown"}`);
        console.log(`   - Created: ${callDetails.callCreated || "Unknown"}`);
        console.log(`   - Ended: ${callDetails.callEnded || "Unknown"}`);

        // Check for recording IDs
        const recordingIds = extractRecordingIds(callDetails);
        console.log(`   - Recording IDs found: ${recordingIds.length}`);

        if (recordingIds.length === 0) {
          console.log("\n⚠️  No recordings found in this call");
          console.log("\n📋 Possible reasons:");
          console.log("   1. Call recording is not enabled in GoTo Connect admin");
          console.log("   2. The call was too short to record");
          console.log("   3. Recording hasn't finished processing yet");
          console.log("\n   Check GoTo Connect admin settings at:");
          console.log("   https://my.goto.com/admin/settings/phone/call-recording");
        } else {
          // 4. Try to fetch recording
          console.log("\n🎙️  Testing recording access...");
          for (const recordingId of recordingIds) {
            console.log(`   Testing recording: ${recordingId}`);
            try {
              const recordingUrl = await fetchRecordingUrl(integration.access_token, recordingId);
              console.log(`   ✅ Recording URL: ${recordingUrl.substring(0, 50)}...`);
            } catch (err) {
              console.log(`   ❌ Recording error: ${err.message}`);
              if (err.message.includes("403") || err.message.includes("401")) {
                console.log("\n   📋 This likely means you need to re-authorize with recording scopes");
                console.log("\n   Reconnect URL:");
                console.log(getAuthUrl());
              }
            }

            // Try transcription
            try {
              const transcript = await fetchTranscription(integration.access_token, recordingId);
              console.log(`   ✅ Transcription available: ${transcript.text?.substring(0, 50)}...`);
            } catch (err) {
              console.log(`   ⚠️  Transcription not available: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      if (err.message.includes("403") || err.message.includes("401")) {
        console.log("\n📋 This likely means you need to re-authorize with the correct scopes");
        console.log("\nReconnect URL:");
        console.log(getAuthUrl());
      }
    }

    // 5. Check subscriptions
    console.log("\n📡 Checking webhook subscriptions...");
    if (!integration.channel_id) {
      console.log("   ⚠️  No webhook channel configured");
      console.log("   Run POST /api/integrations/goto with action='setup' to configure");
    } else {
      console.log(`   Channel ID: ${integration.channel_id}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

function getAuthUrl() {
  const clientId = process.env.GOTO_CLIENT_ID || "28e3e4fc-79b3-4c49-8d4f-76c97361410f";
  const redirectUri = process.env.GOTO_REDIRECT_URI || "https://spencer-mcgaw-os.vercel.app/api/auth/goto/callback";

  const scopes = [
    "call-events.v1.notifications.manage",
    "call-events.v1.events.read",
    "cr.v1.read",
    "call-history.v1.notifications.manage",
    "recording.v1.read",
    "recording.v1.notifications.manage",
    "voicemail.v1.voicemails.read",
    "voicemail.v1.notifications.manage",
  ].join("+");

  return `https://authentication.logmeininc.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;
}

async function refreshToken(refreshToken) {
  const clientId = process.env.GOTO_CLIENT_ID || "28e3e4fc-79b3-4c49-8d4f-76c97361410f";
  const clientSecret = process.env.GOTO_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("GOTO_CLIENT_SECRET not set");
  }

  const response = await fetch(`${GOTO_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return response.json();
}

async function fetchCallReports(accessToken, accountKey, startTime) {
  const params = new URLSearchParams({
    accountKey,
    startTime: startTime.toISOString(),
    endTime: new Date().toISOString(),
  });

  const response = await fetch(`${GOTO_API_BASE}/call-events-report/v1/report-summaries?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Call reports API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  console.log("   Raw call reports response:", JSON.stringify(data, null, 2).substring(0, 500));

  // Handle different response formats
  if (Array.isArray(data)) {
    return data;
  }
  if (data.items) {
    return data.items;
  }
  if (data.reports) {
    return data.reports;
  }
  return [];
}

async function fetchCallDetails(accessToken, conversationSpaceId) {
  const response = await fetch(`${GOTO_API_BASE}/call-events-report/v1/reports/${conversationSpaceId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Call details API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  console.log("\n   Full call details response:");
  console.log(JSON.stringify(data, null, 2));
  return data;
}

function extractRecordingIds(callDetails) {
  const ids = [];

  // Check caller.recordingId (summary format)
  if (callDetails.caller?.recordingId) {
    ids.push(callDetails.caller.recordingId);
  }

  // Check participants[].recordings[].id (detailed format)
  if (callDetails.participants) {
    for (const p of callDetails.participants) {
      // Old format: recordingId directly on participant
      if (p.recordingId) {
        ids.push(p.recordingId);
      }
      // New format: recordings array with id field
      if (p.recordings && Array.isArray(p.recordings)) {
        for (const rec of p.recordings) {
          if (rec.id) {
            ids.push(rec.id);
          }
        }
      }
    }
  }

  return [...new Set(ids)]; // Remove duplicates
}

async function fetchRecordingUrl(accessToken, recordingId) {
  // First get the content token
  const response = await fetch(`${GOTO_API_BASE}/recording/v1/recordings/${recordingId}/content`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Recording API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  console.log("   Recording API response:", JSON.stringify(data, null, 2).substring(0, 300));

  // If we get a token, construct the download URL
  if (data.token?.token) {
    const downloadUrl = `https://api.goto.com/recording/v1/recordings/${recordingId}/download?token=${encodeURIComponent(data.token.token)}`;
    console.log("   Constructed download URL");
    return downloadUrl;
  }

  return data.url || data.contentUrl || data.downloadUrl || null;
}

async function fetchTranscription(accessToken, transcriptId) {
  const response = await fetch(`${GOTO_API_BASE}/recording/v1/transcriptions/${transcriptId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transcription API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  console.log("   Transcription API response:", JSON.stringify(data, null, 2).substring(0, 500));
  return data;
}

testGoToRecordings().catch(console.error);
