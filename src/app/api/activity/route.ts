import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const resourceType = searchParams.get("resourceType");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const search = searchParams.get("search");
  const limit = searchParams.get("limit") || "50";
  const offset = searchParams.get("offset") || "0";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limitNum = parseInt(limit);
  const needsCount = limitNum > 20;

  try {
    // Simple query without join - more reliable
    let query = supabase
      .from("activity_log")
      .select("*", needsCount ? { count: "exact" } : undefined)
      .order("created_at", { ascending: false })
      .range(parseInt(offset), parseInt(offset) + limitNum - 1);

    if (resourceType && resourceType !== "all") {
      query = query.eq("resource_type", resourceType);
    }

    if (action && action !== "all") {
      query = query.eq("action", action);
    }

    if (userId && userId !== "all") {
      query = query.eq("user_id", userId);
    }

    if (search) {
      query = query.ilike("resource_name", `%${search}%`);
    }

    const { data: rawActivities, error, count } = await query;

    if (error) {
      console.error("Error fetching activity log:", error);
      // Return empty array if table doesn't exist or query fails
      return NextResponse.json({ activities: [], count: 0 });
    }

    // Map activities
    const activities = (rawActivities || []).map((a: Record<string, unknown>) => ({
      id: a.id,
      user_id: a.user_id,
      action: a.action,
      resource_type: a.resource_type,
      resource_id: a.resource_id,
      resource_name: a.resource_name,
      details: a.details,
      created_at: a.created_at,
      user_email: null,
      user_name: null,
    }));

    return NextResponse.json({ activities, count });
  } catch (error) {
    console.error("Activity API error:", error);
    // Return empty array on any error to not break the dashboard
    return NextResponse.json({ activities: [], count: 0 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      action,
      resource_type,
      resource_id,
      resource_name,
      details,
    } = body;

    if (!action || !resource_type) {
      return NextResponse.json({ error: "Action and resource_type are required" }, { status: 400 });
    }

    const { data: activity, error } = await supabase
      .from("activity_log")
      .insert({
        user_id: user.id,
        action,
        resource_type,
        resource_id,
        resource_name,
        details,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating activity log:", error);
      return NextResponse.json({ error: "Failed to create activity log" }, { status: 500 });
    }

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("Error creating activity log:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
