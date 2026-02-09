/**
 * AI Learning System - Track user corrections and improve over time
 *
 * Tracks when users:
 * - Change AI-suggested assignments
 * - Modify AI-suggested priorities
 * - Edit AI-generated titles/descriptions
 * - Dismiss or reject action items
 *
 * Uses this data to improve future suggestions
 */

interface AIFeedback {
  emailId: string;
  userId: string;
  feedbackType:
    | "assignment_changed"
    | "priority_changed"
    | "title_edited"
    | "description_edited"
    | "action_dismissed"
    | "action_approved"
    | "routing_override";
  originalValue: string;
  correctedValue: string;
  context: {
    emailCategory?: string;
    clientId?: string;
    priority?: string;
    actionType?: string;
    routingRule?: string;
    [key: string]: unknown;
  };
  timestamp: Date;
}

interface AILearningMetrics {
  accuracyRate: number; // % of suggestions accepted without changes
  assignmentAccuracy: number;
  priorityAccuracy: number;
  titleAccuracy: number;
  totalFeedbackCount: number;
  recentImprovements: string[];
}

/**
 * Record user feedback on AI suggestions
 */
export async function recordAIFeedback(feedback: Omit<AIFeedback, "timestamp">): Promise<void> {
  try {
    const response = await fetch("/api/ai-learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...feedback,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error("Failed to record AI feedback:", await response.text());
    }
  } catch (error) {
    console.error("Error recording AI feedback:", error);
  }
}

/**
 * Get AI learning metrics
 */
export async function getAILearningMetrics(): Promise<AILearningMetrics> {
  try {
    const response = await fetch("/api/ai-learning");
    if (response.ok) {
      const data = await response.json();
      return data.metrics;
    }
  } catch (error) {
    console.error("Error fetching AI learning metrics:", error);
  }

  // Return defaults on error
  return {
    accuracyRate: 0,
    assignmentAccuracy: 0,
    priorityAccuracy: 0,
    titleAccuracy: 0,
    totalFeedbackCount: 0,
    recentImprovements: [],
  };
}

/**
 * Track when user changes assignment from AI suggestion
 */
export function trackAssignmentChange(
  emailId: string,
  userId: string,
  aiSuggestedAssignee: string,
  userSelectedAssignee: string,
  context: AIFeedback["context"]
): void {
  if (aiSuggestedAssignee !== userSelectedAssignee) {
    recordAIFeedback({
      emailId,
      userId,
      feedbackType: "assignment_changed",
      originalValue: aiSuggestedAssignee,
      correctedValue: userSelectedAssignee,
      context,
    });
  }
}

/**
 * Track when user changes priority from AI suggestion
 */
export function trackPriorityChange(
  emailId: string,
  userId: string,
  aiSuggestedPriority: string,
  userSelectedPriority: string,
  context: AIFeedback["context"]
): void {
  if (aiSuggestedPriority !== userSelectedPriority) {
    recordAIFeedback({
      emailId,
      userId,
      feedbackType: "priority_changed",
      originalValue: aiSuggestedPriority,
      correctedValue: userSelectedPriority,
      context,
    });
  }
}

/**
 * Track when user edits AI-generated title
 */
export function trackTitleEdit(
  emailId: string,
  userId: string,
  aiGeneratedTitle: string,
  userEditedTitle: string,
  context: AIFeedback["context"]
): void {
  if (aiGeneratedTitle !== userEditedTitle) {
    recordAIFeedback({
      emailId,
      userId,
      feedbackType: "title_edited",
      originalValue: aiGeneratedTitle,
      correctedValue: userEditedTitle,
      context,
    });
  }
}

/**
 * Track when user dismisses an action item
 */
export function trackActionDismissed(
  emailId: string,
  userId: string,
  actionTitle: string,
  context: AIFeedback["context"]
): void {
  recordAIFeedback({
    emailId,
    userId,
    feedbackType: "action_dismissed",
    originalValue: actionTitle,
    correctedValue: "dismissed",
    context,
  });
}

/**
 * Track when user approves/uses an action item without changes
 */
export function trackActionApproved(
  emailId: string,
  userId: string,
  actionTitle: string,
  context: AIFeedback["context"]
): void {
  recordAIFeedback({
    emailId,
    userId,
    feedbackType: "action_approved",
    originalValue: actionTitle,
    correctedValue: "approved",
    context,
  });
}

/**
 * Calculate improvement trends
 */
export function calculateImprovementTrend(
  currentMetrics: AILearningMetrics,
  previousMetrics: AILearningMetrics
): {
  improving: boolean;
  change: number;
  message: string;
} {
  const change = currentMetrics.accuracyRate - previousMetrics.accuracyRate;
  const improving = change > 0;

  let message = "";
  if (change > 5) {
    message = `AI accuracy improved by ${Math.round(change)}% this month!`;
  } else if (change < -5) {
    message = `AI accuracy decreased by ${Math.abs(Math.round(change))}% - collecting more feedback`;
  } else {
    message = "AI accuracy stable - continue providing feedback to improve";
  }

  return { improving, change, message };
}

/**
 * Get personalized AI insights based on feedback patterns
 */
export function getPersonalizedInsights(metrics: AILearningMetrics): string[] {
  const insights: string[] = [];

  if (metrics.assignmentAccuracy < 70) {
    insights.push("💡 Assignment suggestions are learning your team's expertise");
  } else if (metrics.assignmentAccuracy > 85) {
    insights.push("✨ Assignment suggestions are highly accurate!");
  }

  if (metrics.priorityAccuracy < 70) {
    insights.push("💡 Priority detection is learning your urgency patterns");
  } else if (metrics.priorityAccuracy > 85) {
    insights.push("✨ Priority detection matches your judgment well!");
  }

  if (metrics.titleAccuracy < 70) {
    insights.push("💡 Task titles are being refined based on your edits");
  } else if (metrics.titleAccuracy > 85) {
    insights.push("✨ Task titles rarely need editing!");
  }

  if (metrics.accuracyRate > 80) {
    insights.push("🎯 Overall AI accuracy is excellent - great teamwork!");
  }

  if (metrics.totalFeedbackCount < 10) {
    insights.push("📊 Collecting initial feedback - AI will improve as you use it");
  }

  return insights;
}
