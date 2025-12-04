import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface SenderRule {
  id: string;
  ruleType: "email" | "domain";
  matchType: "exact" | "contains" | "ends_with";
  matchValue: string;
  action: "whitelist" | "blacklist";
  reason?: string;
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
}

// Get all sender rules
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: rules, error } = await supabase
      .from("email_sender_rules")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sender rules:", error);
      return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }

    const formattedRules: SenderRule[] = (rules || []).map((rule) => ({
      id: rule.id,
      ruleType: rule.rule_type,
      matchType: rule.match_type,
      matchValue: rule.match_value,
      action: rule.action,
      reason: rule.reason,
      isActive: rule.is_active,
      createdAt: new Date(rule.created_at),
      createdBy: rule.created_by,
    }));

    return NextResponse.json({ rules: formattedRules });
  } catch (error) {
    console.error("Get sender rules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Create a new sender rule
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ruleType, matchType, matchValue, action, reason } = body;

    if (!ruleType || !matchType || !matchValue || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate values
    if (!["email", "domain"].includes(ruleType)) {
      return NextResponse.json({ error: "Invalid rule type" }, { status: 400 });
    }
    if (!["exact", "contains", "ends_with"].includes(matchType)) {
      return NextResponse.json({ error: "Invalid match type" }, { status: 400 });
    }
    if (!["whitelist", "blacklist"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("email_sender_rules")
      .insert({
        created_by: user.id,
        rule_type: ruleType,
        match_type: matchType,
        match_value: matchValue.toLowerCase(),
        action,
        reason,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") { // Unique violation
        return NextResponse.json({ error: "Rule already exists" }, { status: 409 });
      }
      console.error("Error creating sender rule:", error);
      return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rule: {
        id: data.id,
        ruleType: data.rule_type,
        matchType: data.match_type,
        matchValue: data.match_value,
        action: data.action,
        reason: data.reason,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
      },
    });
  } catch (error) {
    console.error("Create sender rule error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete a sender rule
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get("id");

    if (!ruleId) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from("email_sender_rules")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", ruleId);

    if (error) {
      console.error("Error deleting sender rule:", error);
      return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete sender rule error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
