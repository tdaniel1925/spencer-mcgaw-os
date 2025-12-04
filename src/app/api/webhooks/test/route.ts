import { NextResponse } from "next/server";
import { db } from "@/db";
import { calls } from "@/db/schema";

export async function GET() {
  try {
    // Simple test insert
    const testId = `test-${Date.now()}`;
    const [result] = await db.insert(calls).values({
      vapiCallId: testId,
      callerPhone: "+15559999999",
      callerName: "Test User",
      status: "completed",
      direction: "inbound",
      duration: 60,
      transcription: "Test transcript",
      summary: "Test summary",
      metadata: { test: true },
    }).returning({ id: calls.id });

    return NextResponse.json({
      success: true,
      message: "Database insert successful",
      callId: result?.id,
      testId,
    });
  } catch (error) {
    console.error("Test route error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
