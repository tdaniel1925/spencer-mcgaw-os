/**
 * Smart Email Assignment Rules Engine
 *
 * Evaluates assignment rules to determine:
 * - Which user should handle the email
 * - Which Kanban column to place it in
 * - What priority to assign
 * - Whether to auto-create tasks
 */

import { createClient } from "@/lib/supabase/server";
import type { AIClassificationResult } from "./ai-classifier";

// Rule condition types
export interface RuleCondition {
  field: "sender_email" | "sender_domain" | "subject" | "category" | "priority_score" | "has_attachments" | "contains_keyword" | "client_matched";
  operator: "equals" | "contains" | "starts_with" | "ends_with" | "greater_than" | "less_than" | "is_true" | "is_false";
  value: string | number | boolean;
  caseSensitive?: boolean;
}

// Assignment rule
export interface AssignmentRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  conditions: RuleCondition[];
  conditionOperator: "and" | "or";
  actions: {
    assignToUserId?: string;
    assignToColumn?: string;
    setPriority?: "low" | "medium" | "high" | "urgent";
    addTags?: string[];
    autoCreateTask?: boolean;
    taskTemplateId?: string;
  };
  timesMatched: number;
  timesOverridden: number;
}

// Assignment result
export interface AssignmentResult {
  assignedUserId?: string;
  assignedUserName?: string;
  assignedColumn: string;
  priority: "low" | "medium" | "high" | "urgent";
  tags: string[];
  shouldCreateTask: boolean;
  taskTemplateId?: string;
  matchedRules: string[];
  assignmentReason: string;
}

/**
 * Evaluate a single condition against email data
 */
function evaluateCondition(
  condition: RuleCondition,
  email: {
    senderEmail: string;
    senderDomain: string;
    subject: string;
    body?: string;
    classification: AIClassificationResult;
    hasAttachments: boolean;
    clientMatched: boolean;
  }
): boolean {
  let fieldValue: string | number | boolean;

  switch (condition.field) {
    case "sender_email":
      fieldValue = condition.caseSensitive
        ? email.senderEmail
        : email.senderEmail.toLowerCase();
      break;
    case "sender_domain":
      fieldValue = email.senderDomain.toLowerCase();
      break;
    case "subject":
      fieldValue = condition.caseSensitive
        ? email.subject
        : email.subject.toLowerCase();
      break;
    case "category":
      fieldValue = email.classification.category;
      break;
    case "priority_score":
      fieldValue = email.classification.priorityScore;
      break;
    case "has_attachments":
      fieldValue = email.hasAttachments;
      break;
    case "contains_keyword":
      // Search in subject and body
      const searchText = `${email.subject} ${email.body || ""}`.toLowerCase();
      fieldValue = searchText.includes(String(condition.value).toLowerCase());
      break;
    case "client_matched":
      fieldValue = email.clientMatched;
      break;
    default:
      return false;
  }

  const conditionValue = condition.caseSensitive
    ? condition.value
    : typeof condition.value === "string"
    ? condition.value.toLowerCase()
    : condition.value;

  switch (condition.operator) {
    case "equals":
      return fieldValue === conditionValue;
    case "contains":
      return String(fieldValue).includes(String(conditionValue));
    case "starts_with":
      return String(fieldValue).startsWith(String(conditionValue));
    case "ends_with":
      return String(fieldValue).endsWith(String(conditionValue));
    case "greater_than":
      return Number(fieldValue) > Number(conditionValue);
    case "less_than":
      return Number(fieldValue) < Number(conditionValue);
    case "is_true":
      return fieldValue === true;
    case "is_false":
      return fieldValue === false;
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a rule
 */
function evaluateRule(
  rule: AssignmentRule,
  email: {
    senderEmail: string;
    senderDomain: string;
    subject: string;
    body?: string;
    classification: AIClassificationResult;
    hasAttachments: boolean;
    clientMatched: boolean;
  }
): boolean {
  if (!rule.isActive || rule.conditions.length === 0) {
    return false;
  }

  const results = rule.conditions.map((condition) =>
    evaluateCondition(condition, email)
  );

  if (rule.conditionOperator === "and") {
    return results.every((r) => r);
  } else {
    return results.some((r) => r);
  }
}

/**
 * Load assignment rules from database
 */
export async function loadAssignmentRules(): Promise<AssignmentRule[]> {
  const supabase = await createClient();

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
      times_overridden
    `)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (error) {
    console.error("[Assignment Engine] Error loading rules:", error);
    return [];
  }

  return (rules || []).map((rule) => ({
    id: rule.id,
    name: rule.name,
    description: rule.description,
    isActive: rule.is_active,
    priority: rule.priority,
    conditions: rule.conditions as RuleCondition[],
    conditionOperator: rule.condition_operator as "and" | "or",
    actions: {
      assignToUserId: rule.assign_to_user_id,
      assignToColumn: rule.assign_to_column,
      setPriority: rule.set_priority as "low" | "medium" | "high" | "urgent" | undefined,
      addTags: rule.add_tags,
      autoCreateTask: rule.auto_create_task,
      taskTemplateId: rule.task_template_id,
    },
    timesMatched: rule.times_matched || 0,
    timesOverridden: rule.times_overridden || 0,
  }));
}

/**
 * Get learned assignment patterns from user actions
 */
async function getLearnedPatterns(
  senderEmail: string,
  senderDomain: string,
  category: string
): Promise<{
  suggestedColumn?: string;
  suggestedUserId?: string;
  confidence: number;
}> {
  const supabase = await createClient();

  // Check sender-specific patterns (highest confidence)
  const { data: senderActions } = await supabase
    .from("email_user_actions")
    .select("action_type, action_value, new_column, new_assignee")
    .eq("sender_email", senderEmail.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  if (senderActions && senderActions.length >= 2) {
    // Count column movements
    const columnCounts = new Map<string, number>();
    const assigneeCounts = new Map<string, number>();

    for (const action of senderActions) {
      if (action.new_column) {
        columnCounts.set(
          action.new_column,
          (columnCounts.get(action.new_column) || 0) + 1
        );
      }
      if (action.new_assignee) {
        assigneeCounts.set(
          action.new_assignee,
          (assigneeCounts.get(action.new_assignee) || 0) + 1
        );
      }
    }

    // Find most common patterns
    let mostCommonColumn: string | undefined;
    let maxColumnCount = 0;
    columnCounts.forEach((count, column) => {
      if (count > maxColumnCount) {
        maxColumnCount = count;
        mostCommonColumn = column;
      }
    });

    let mostCommonAssignee: string | undefined;
    let maxAssigneeCount = 0;
    assigneeCounts.forEach((count, assignee) => {
      if (count > maxAssigneeCount) {
        maxAssigneeCount = count;
        mostCommonAssignee = assignee;
      }
    });

    if (mostCommonColumn || mostCommonAssignee) {
      const confidence = Math.min(
        (maxColumnCount + maxAssigneeCount) / (senderActions.length * 2),
        0.95
      );
      return {
        suggestedColumn: mostCommonColumn,
        suggestedUserId: mostCommonAssignee,
        confidence,
      };
    }
  }

  // Check domain patterns (medium confidence)
  const { data: domainActions } = await supabase
    .from("email_user_actions")
    .select("new_column, new_assignee")
    .eq("sender_domain", senderDomain.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(20);

  if (domainActions && domainActions.length >= 3) {
    const columnCounts = new Map<string, number>();
    for (const action of domainActions) {
      if (action.new_column) {
        columnCounts.set(
          action.new_column,
          (columnCounts.get(action.new_column) || 0) + 1
        );
      }
    }

    let mostCommonColumn: string | undefined;
    let maxCount = 0;
    columnCounts.forEach((count, column) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonColumn = column;
      }
    });

    if (mostCommonColumn && maxCount >= 2) {
      return {
        suggestedColumn: mostCommonColumn,
        confidence: Math.min(maxCount / domainActions.length, 0.7),
      };
    }
  }

  // Check category patterns (lower confidence)
  const { data: categoryActions } = await supabase
    .from("email_user_actions")
    .select("new_column")
    .eq("ai_category", category)
    .order("created_at", { ascending: false })
    .limit(50);

  if (categoryActions && categoryActions.length >= 5) {
    const columnCounts = new Map<string, number>();
    for (const action of categoryActions) {
      if (action.new_column) {
        columnCounts.set(
          action.new_column,
          (columnCounts.get(action.new_column) || 0) + 1
        );
      }
    }

    let mostCommonColumn: string | undefined;
    let maxCount = 0;
    columnCounts.forEach((count, column) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonColumn = column;
      }
    });

    if (mostCommonColumn && maxCount >= 3) {
      return {
        suggestedColumn: mostCommonColumn,
        confidence: Math.min(maxCount / categoryActions.length, 0.5),
      };
    }
  }

  return { confidence: 0 };
}

/**
 * Determine assignment for an email
 */
export async function determineAssignment(
  email: {
    senderEmail: string;
    subject: string;
    body?: string;
    classification: AIClassificationResult;
    hasAttachments: boolean;
    clientMatched: boolean;
    matchedClientAssigneeId?: string;
  }
): Promise<AssignmentResult> {
  const senderDomain = email.senderEmail.split("@")[1]?.toLowerCase() || "";
  const matchedRules: string[] = [];
  const tags: string[] = [];

  // Default assignment
  let result: AssignmentResult = {
    assignedColumn: "pending",
    priority: email.classification.priorityScore >= 80
      ? "urgent"
      : email.classification.priorityScore >= 60
      ? "high"
      : email.classification.priorityScore >= 40
      ? "medium"
      : "low",
    tags: [],
    shouldCreateTask: false,
    matchedRules: [],
    assignmentReason: "Default assignment based on AI classification",
  };

  // 1. Load and evaluate explicit rules
  const rules = await loadAssignmentRules();

  for (const rule of rules) {
    const matches = evaluateRule(rule, {
      senderEmail: email.senderEmail,
      senderDomain,
      subject: email.subject,
      body: email.body,
      classification: email.classification,
      hasAttachments: email.hasAttachments,
      clientMatched: email.clientMatched,
    });

    if (matches) {
      matchedRules.push(rule.id);

      // Apply rule actions
      if (rule.actions.assignToUserId) {
        result.assignedUserId = rule.actions.assignToUserId;
      }
      if (rule.actions.assignToColumn) {
        result.assignedColumn = rule.actions.assignToColumn;
      }
      if (rule.actions.setPriority) {
        result.priority = rule.actions.setPriority;
      }
      if (rule.actions.addTags) {
        tags.push(...rule.actions.addTags);
      }
      if (rule.actions.autoCreateTask) {
        result.shouldCreateTask = true;
        result.taskTemplateId = rule.actions.taskTemplateId;
      }

      result.assignmentReason = `Matched rule: ${rule.name}`;

      // Update rule match count
      const supabase = await createClient();
      await supabase
        .from("email_assignment_rules")
        .update({
          times_matched: rule.timesMatched + 1,
          last_matched_at: new Date().toISOString(),
        })
        .eq("id", rule.id);
    }
  }

  // 2. If no rules matched, check learned patterns
  if (matchedRules.length === 0) {
    const learnedPatterns = await getLearnedPatterns(
      email.senderEmail,
      senderDomain,
      email.classification.category
    );

    if (learnedPatterns.confidence >= 0.5) {
      if (learnedPatterns.suggestedColumn) {
        result.assignedColumn = learnedPatterns.suggestedColumn;
        result.assignmentReason = `Learned pattern (${Math.round(learnedPatterns.confidence * 100)}% confidence)`;
      }
      if (learnedPatterns.suggestedUserId) {
        result.assignedUserId = learnedPatterns.suggestedUserId;
      }
    }
  }

  // 3. If client is matched and has an assigned user, suggest that user
  if (!result.assignedUserId && email.matchedClientAssigneeId) {
    result.assignedUserId = email.matchedClientAssigneeId;
    result.assignmentReason += " (Client's assigned user)";
  }

  // 4. Add category-based tags
  tags.push(email.classification.category);
  if (email.classification.urgency === "urgent") {
    tags.push("urgent");
  }
  if (email.hasAttachments) {
    tags.push("has-attachments");
  }

  result.tags = [...new Set(tags)]; // Deduplicate
  result.matchedRules = matchedRules;

  // Get assigned user name if we have an ID
  if (result.assignedUserId) {
    const supabase = await createClient();
    const { data: user } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", result.assignedUserId)
      .single();
    if (user) {
      result.assignedUserName = user.full_name;
    }
  }

  return result;
}

/**
 * Record user action for learning
 */
export async function recordUserAction(
  userId: string,
  emailMessageId: string,
  email: {
    senderEmail: string;
    subject: string;
    category: string;
    priority: string;
  },
  action: {
    type: "move_to_column" | "assign" | "mark_relevant" | "mark_rejected" | "create_task" | "archive" | "delete";
    value?: string;
    previousColumn?: string;
    previousAssignee?: string;
    newColumn?: string;
    newAssignee?: string;
  },
  timeToActionMs?: number
): Promise<void> {
  const supabase = await createClient();
  const senderDomain = email.senderEmail.split("@")[1]?.toLowerCase() || "";

  await supabase.from("email_user_actions").insert({
    user_id: userId,
    email_message_id: emailMessageId,
    sender_email: email.senderEmail.toLowerCase(),
    sender_domain: senderDomain,
    subject: email.subject,
    ai_category: email.category,
    ai_priority: email.priority,
    action_type: action.type,
    action_value: action.value,
    previous_column: action.previousColumn,
    previous_assignee: action.previousAssignee,
    new_column: action.newColumn,
    new_assignee: action.newAssignee,
    time_to_action_ms: timeToActionMs,
  });
}

/**
 * Create a new assignment rule
 */
export async function createAssignmentRule(
  rule: Omit<AssignmentRule, "id" | "timesMatched" | "timesOverridden">,
  createdBy: string
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("email_assignment_rules")
    .insert({
      name: rule.name,
      description: rule.description,
      is_active: rule.isActive,
      priority: rule.priority,
      conditions: rule.conditions,
      condition_operator: rule.conditionOperator,
      assign_to_user_id: rule.actions.assignToUserId,
      assign_to_column: rule.actions.assignToColumn,
      set_priority: rule.actions.setPriority,
      add_tags: rule.actions.addTags,
      auto_create_task: rule.actions.autoCreateTask,
      task_template_id: rule.actions.taskTemplateId,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create rule: ${error.message}`);
  }

  return data.id;
}

/**
 * Suggest a rule based on user action patterns
 */
export async function suggestRuleFromPattern(
  senderEmail: string,
  userId: string
): Promise<AssignmentRule | null> {
  const supabase = await createClient();
  const senderDomain = senderEmail.split("@")[1]?.toLowerCase() || "";

  // Look for consistent patterns from this sender
  const { data: actions } = await supabase
    .from("email_user_actions")
    .select("*")
    .eq("sender_email", senderEmail.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  if (!actions || actions.length < 3) {
    return null;
  }

  // Check if actions are consistent
  const columns = actions.map((a) => a.new_column).filter(Boolean);
  const assignees = actions.map((a) => a.new_assignee).filter(Boolean);

  const mostCommonColumn = columns.length > 0
    ? columns.sort((a, b) =>
        columns.filter((v) => v === a).length -
        columns.filter((v) => v === b).length
      ).pop()
    : null;

  const mostCommonAssignee = assignees.length > 0
    ? assignees.sort((a, b) =>
        assignees.filter((v) => v === a).length -
        assignees.filter((v) => v === b).length
      ).pop()
    : null;

  // Only suggest if there's a clear pattern (>60% consistency)
  const columnConsistency = mostCommonColumn
    ? columns.filter((c) => c === mostCommonColumn).length / columns.length
    : 0;
  const assigneeConsistency = mostCommonAssignee
    ? assignees.filter((a) => a === mostCommonAssignee).length / assignees.length
    : 0;

  if (columnConsistency < 0.6 && assigneeConsistency < 0.6) {
    return null;
  }

  return {
    id: "",
    name: `Auto-route emails from ${senderDomain}`,
    description: `Suggested rule based on ${actions.length} previous actions`,
    isActive: false, // User must activate
    priority: 10,
    conditions: [
      {
        field: "sender_email",
        operator: "equals",
        value: senderEmail.toLowerCase(),
      },
    ],
    conditionOperator: "and",
    actions: {
      assignToColumn: mostCommonColumn || undefined,
      assignToUserId: mostCommonAssignee || undefined,
    },
    timesMatched: 0,
    timesOverridden: 0,
  };
}
