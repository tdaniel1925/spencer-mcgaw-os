import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Health check endpoint for monitoring
 * GET /api/health
 *
 * Returns:
 * - 200: All systems operational
 * - 503: Service degraded (database issues)
 */
export async function GET() {
  const startTime = Date.now();

  const health: {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    version: string;
    uptime: number;
    checks: {
      database: { status: string; latency?: number; error?: string };
      environment: { status: string };
    };
  } = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
    checks: {
      database: { status: "unknown" },
      environment: { status: "ok" },
    },
  };

  // Check required environment variables
  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingEnvVars.length > 0) {
    health.checks.environment = {
      status: "error",
    };
    health.status = "degraded";
  }

  // Check database connectivity
  try {
    const dbStartTime = Date.now();
    const supabase = await createClient();

    // Simple query to check connectivity
    const { error } = await supabase
      .from("user_profiles")
      .select("id")
      .limit(1);

    const dbLatency = Date.now() - dbStartTime;

    if (error) {
      health.checks.database = {
        status: "error",
        latency: dbLatency,
        error: error.message,
      };
      health.status = "degraded";
    } else {
      health.checks.database = {
        status: "ok",
        latency: dbLatency,
      };
    }
  } catch (error) {
    health.checks.database = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    health.status = "unhealthy";
  }

  // Add total response time
  const totalTime = Date.now() - startTime;

  const statusCode = health.status === "healthy" ? 200 :
                     health.status === "degraded" ? 200 : 503;

  return NextResponse.json(
    {
      ...health,
      responseTime: totalTime,
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
