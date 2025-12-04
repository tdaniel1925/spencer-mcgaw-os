import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  // Check if DATABASE_URL is set
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({
      success: false,
      error: "DATABASE_URL not set",
    }, { status: 500 });
  }

  // Convert direct connection to pooler connection for serverless
  // db.xxx.supabase.co:5432 -> aws-0-us-east-1.pooler.supabase.com:6543
  if (dbUrl.includes("db.") && dbUrl.includes(".supabase.co")) {
    // Extract project ref from the direct connection URL
    const projectRef = dbUrl.match(/db\.([^.]+)\.supabase\.co/)?.[1];
    if (projectRef) {
      // Construct pooler URL
      // Format: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
      const passwordMatch = dbUrl.match(/:([^@]+)@/);
      const password = passwordMatch?.[1];
      if (password) {
        dbUrl = `postgresql://postgres.${projectRef}:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
      }
    }
  }

  // Create a fresh connection for this request
  const sql = postgres(dbUrl, {
    ssl: "require",
    max: 1,
  });

  try {
    // Test raw SQL insert
    const testId = `test-raw-${Date.now()}`;
    const result = await sql`
      INSERT INTO calls (vapi_call_id, caller_phone, caller_name, status, direction, duration, transcription, summary, metadata)
      VALUES (${testId}, '+15559999999', 'Test User', 'completed', 'inbound', 60, 'Test transcript', 'Test summary', '{"test": true}'::jsonb)
      RETURNING id
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      message: "Database insert successful",
      callId: result[0]?.id,
      testId,
      dbUrlPrefix: dbUrl.substring(0, 40) + "...",
      usingPooler: dbUrl.includes("pooler"),
    });
  } catch (error) {
    await sql.end();
    console.error("Test route error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      dbUrlPrefix: dbUrl.substring(0, 40) + "...",
      usingPooler: dbUrl.includes("pooler"),
    }, { status: 500 });
  }
}
