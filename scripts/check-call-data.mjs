import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "db.cyygkhwujcrbhzgjqipj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "ttandSellaBella1234",
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const client = await pool.connect();
  try {
    // Check recent webhook logs
    const logs = await client.query(`
      SELECT id, source, status, raw_payload, error_message, created_at
      FROM webhook_logs
      WHERE source = 'goto'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log("Recent GoTo Webhook Logs:");
    console.log("=========================");
    logs.rows.forEach((r, i) => {
      console.log(`\n[${i+1}] ${r.status} at ${r.created_at}`);
      console.log("Payload:", JSON.stringify(r.raw_payload, null, 2));
      if (r.error_message) console.log("Error:", r.error_message);
    });

    // Check recent calls
    const calls = await client.query(`
      SELECT id, caller_phone, direction, duration, status, recording_url, transcription, summary, metadata
      FROM calls
      WHERE metadata->>'sourceProvider' = 'goto'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log("\n\nRecent GoTo Calls:");
    console.log("==================");
    calls.rows.forEach((r, i) => {
      console.log(`\n[${i+1}] ${r.direction} call from ${r.caller_phone || "unknown"}`);
      console.log("  Duration:", r.duration, "seconds");
      console.log("  Recording URL:", r.recording_url || "NONE");
      console.log("  Transcript:", r.transcription ? r.transcription.substring(0, 100) + "..." : "NONE");
      console.log("  Summary:", r.summary || "NONE");
      console.log("  Metadata:", JSON.stringify(r.metadata, null, 2));
    });

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
