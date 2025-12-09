/**
 * Email Assignment Rules API
 *
 * CRUD operations for email assignment rules
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  loadAssignmentRules,
  createAssignmentRule,
  suggestRuleFromPattern,
  type AssignmentRule,
  type RuleCondition,
} from "@/lib/email/assignment-engine";

// Get all assignment rules
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const suggestFor = searchParams.get("suggestFor"); // sender email to suggest rule for

    // If suggesting a rule for a sender
    if (suggestFor) {
      const suggestedRule = await suggestRuleFromPattern(suggestFor, user.id);
      return NextResponse.json({
        success: true,
        suggestedRule,
      });
    }

    // Get all rules
    const { data: rules, error } = await supabase
      .from("email_assignment_rules")
      .select(`
        id,
        name,
        description,
        is_active,
        priority,
        conditions,
        condition_operator,
        assign_to_user_id,
        assign_to_column,
        set_priority,
        add_tags,
        auto_create_task,
        task_template_id,
        times_matched,
        times_overridden,
        last_matched_at,
        created_by,
        created_at,
        updated_at
      `)
      .order("priority", { ascending: false });

    if (error) {
      throw error;
    }

    // Filter inactive if needed
    const filteredRules = includeInactive
      ? rules
      : rules?.filter((r) => r.is_active);

    // Get user names for assigned users
    const userIds = [...new Set(filteredRules?.map((r) => r.assign_to_user_id).filter(Boolean))];
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const userMap = new Map(users?.map((u) => [u.id, u]) || []);

    const formattedRules = filteredRules?.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      isActive: rule.is_active,
      priority: rule.priority,
      conditions: rule.conditions as RuleCondition[],
      conditionOperator: rule.condition_operator,
      actions: {
        assignToUserId: rule.assign_to_user_id,
        assignToUserName: userMap.get(rule.assign_to_user_id)?.full_name,
        assignToColumn: rule.assign_to_column,
        setPriority: rule.set_priority,
        addTags: rule.add_tags,
        autoCreateTask: rule.auto_create_task,
        taskTemplateId: rule.task_template_id,
      },
      stats: {
        timesMatched: rule.times_matched || 0,
        timesOverridden: rule.times_overridden || 0,
        lastMatchedAt: rule.last_matched_at,
        effectiveness: rule.times_matched > 0
          ? ((rule.times_matched - (rule.times_overridden || 0)) / rule.times_matched) * 100
          : null,
      },
      createdBy: rule.created_by,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    }));

    return NextResponse.json({
      success: true,
      rules: formattedRules,
      count: formattedRules?.length || 0,
    });
  } catch (error) {
    console.error("[Assignment Rules API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

// Create a new rule
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      isActive = true,
      priority = 0,
      conditions,
      conditionOperator = "and",
      actions,
    } = body;

    if (!name || !conditions || conditions.length === 0) {
      return NextResponse.json(
        { error: "Name and at least one condition required" },
        { status: 400 }
      );
    }

    // Validate conditions
    for (const condition of conditions) {
      if (!condition.field || !condition.operator) {
        return NextResponse.json(
          { error: "Each condition must have field and operator" },
          { status: 400 }
        );
      }
    }

    const ruleId = await createAssignmentRule(
      {
        name,
        description,
        isActive,
        priority,
        conditions,
        conditionOperator,
        actions: {
          assignToUserId: actions?.assignToUserId,
          assignToColumn: actions?.assignToColumn,
          setPriority: actions?.setPriority,
          addTags: actions?.addTags,
          autoCreateTask: actions?.autoCreateTask,
          taskTemplateId: actions?.taskTemplateId,
        },
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      ruleId,
    });
  } catch (error) {
    console.error("[Assignment Rules API] Error creating rule:", error);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}

// Update a rule
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      id,
      name,
      description,
      isActive,
      priority,
      conditions,
      conditionOperator,
      actions,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (priority !== undefined) updateData.priority = priority;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (conditionOperator !== undefined) updateData.condition_operator = conditionOperator;
    if (actions) {
      if (actions.assignToUserId !== undefined) updateData.assign_to_user_id = actions.assignToUserId;
      if (actions.assignToColumn !== undefined) updateData.assign_to_column = actions.assignToColumn;
      if (actions.setPriority !== undefined) updateData.set_priority = actions.setPriority;
      if (actions.addTags !== undefined) updateData.add_tags = actions.addTags;
      if (actions.autoCreateTask !== undefined) updateData.auto_create_task = actions.autoCreateTask;
      if (actions.taskTemplateId !== undefined) updateData.task_template_id = actions.taskTemplateId;
    }

    const { error } = await supabase
      .from("email_assignment_rules")
      .update(updateData)
      .eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Assignment Rules API] Error updating rule:", error);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 }
    );
  }
}

// Delete a rule
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("email_assignment_rules")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Assignment Rules API] Error deleting rule:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}
