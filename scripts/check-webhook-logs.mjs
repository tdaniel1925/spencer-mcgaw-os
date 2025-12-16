import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.cyygkhwujcrbhzgjqipj:ttandSellaBella1234@aws-0-us-west-1.pooler.supabase.com:6543/postgres'
});

async function checkWebhookLogs() {
  try {
    // Check recent GoTo webhooks
    const result = await pool.query(`
      SELECT id, created_at, raw_payload, status, error_message
      FROM webhook_logs
      WHERE source = 'goto'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log("Recent GoTo webhook logs:");
    console.log("=".repeat(60));

    for (const row of result.rows) {
      console.log("\n--- Webhook", row.id, "---");
      console.log("Created:", row.created_at);
      console.log("Status:", row.status);
      if (row.error_message) {
        console.log("Error:", row.error_message);
      }

      // Show key parts of payload
      const payload = row.raw_payload;
      if (payload?.data?.content) {
        const content = payload.data.content;
        console.log("\nPayload content keys:", Object.keys(content));
        console.log("Caller:", content.caller);
        console.log("Participants count:", content.participants?.length);

        // Check for recording IDs
        if (content.caller?.recordingId) {
          console.log("Caller recordingId:", content.caller.recordingId);
        } else {
          console.log("Caller recordingId: NOT FOUND");
        }

        if (content.participants) {
          for (let i = 0; i < content.participants.length; i++) {
            const p = content.participants[i];
            if (p.recordingId) {
              console.log(`Participant ${i} recordingId:`, p.recordingId);
            } else {
              console.log(`Participant ${i} recordingId: NOT FOUND`);
            }
          }
        }
      } else {
        console.log("Raw payload structure:", JSON.stringify(payload, null, 2).substring(0, 500));
      }
    }

    // Also check the calls table for recent records
    const callsResult = await pool.query(`
      SELECT id, caller_phone, caller_name, recording_url, transcription, created_at
      FROM calls
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log("\n\nRecent call records:");
    console.log("=".repeat(60));

    for (const row of callsResult.rows) {
      console.log("\n--- Call", row.id, "---");
      console.log("Phone:", row.caller_phone);
      console.log("Name:", row.caller_name);
      console.log("Recording URL:", row.recording_url ? "YES" : "NO");
      console.log("Transcription:", row.transcription ? "YES (" + row.transcription.length + " chars)" : "NO");
      console.log("Created:", row.created_at);
    }

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

checkWebhookLogs();
