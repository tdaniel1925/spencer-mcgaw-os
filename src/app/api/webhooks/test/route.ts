import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  // Check if DATABASE_URL is set
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({
      success: false,
      error: "DATABASE_URL not set",
    }, { status: 500 });
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
      dbUrlPrefix: dbUrl.substring(0, 30) + "...",
    });
  } catch (error) {
    await sql.end();
    console.error("Test route error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      dbUrlPrefix: dbUrl.substring(0, 30) + "...",
    }, { status: 500 });
  }
}
