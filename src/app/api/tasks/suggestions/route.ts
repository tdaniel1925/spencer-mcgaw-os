import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tasks/suggestions
 * List all pending task suggestions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Filter parameters
    const status = searchParams.get("status") || "pending";
    const sourceType = searchParams.get("source_type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("task_ai_suggestions")
      .select(`
        *,
        client:suggested_client_id(id, first_name, last_name, company_name),
        assigned_user:suggested_assigned_to(id, full_name, email),
        reviewed_by_user:reviewed_by(id, full_name, email)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (sourceType) {
      query = query.eq("source_type", sourceType);
    }

    const { data: suggestions, error } = await query;

    if (error) {
      console.error("[Suggestions API] Error fetching suggestions:", error);
      return NextResponse.json(
        { error: "Failed to fetch suggestions", details: error.message },
        { status: 500 }
      );
    }

    // Get counts by status
    const { data: counts } = await supabase
      .from("task_ai_suggestions")
      .select("status")
      .then(({ data }) => {
        const statusCounts = {
          pending: 0,
          approved: 0,
          declined: 0,
          expired: 0,
        };
        data?.forEach((item) => {
          const s = item.status as keyof typeof statusCounts;
          if (s in statusCounts) {
            statusCounts[s]++;
          }
        });
        return { data: statusCounts };
      });

    return NextResponse.json({
      suggestions,
      counts,
      pagination: {
        limit,
        offset,
        hasMore: suggestions?.length === limit,
      },
    });
  } catch (error) {
    console.error("[Suggestions API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
