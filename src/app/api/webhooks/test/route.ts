import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

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
  const client = postgres(dbUrl, {
    prepare: false,
    ssl: "require",
    max: 1,
  });
  const db = drizzle(client, { schema });

  try {
    // Simple test insert
    const testId = `test-${Date.now()}`;
    const [result] = await db.insert(schema.calls).values({
      vapiCallId: testId,
      callerPhone: "+15559999999",
      callerName: "Test User",
      status: "completed",
      direction: "inbound",
      duration: 60,
      transcription: "Test transcript",
      summary: "Test summary",
      metadata: { test: true },
    }).returning({ id: schema.calls.id });

    await client.end();

    return NextResponse.json({
      success: true,
      message: "Database insert successful",
      callId: result?.id,
      testId,
      dbUrlPrefix: dbUrl.substring(0, 30) + "...",
    });
  } catch (error) {
    await client.end();
    console.error("Test route error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      dbUrlPrefix: dbUrl.substring(0, 30) + "...",
    }, { status: 500 });
  }
}
