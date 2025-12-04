// Email Service Types

// Connected email account
export interface ConnectedEmailAccount {
  id: string;
  email: string;
  displayName: string;
  provider: "microsoft" | "google" | "other";
  isConnected: boolean;
  lastSyncAt: Date | null;
  syncStatus: "idle" | "syncing" | "error";
  syncError?: string;
  settings: {
    autoSync: boolean;
    syncIntervalMinutes: number;
    syncFolders: string[];
    aiFilterEnabled: boolean;
    aiAutoClassify: boolean;
    aiAutoPrioritize: boolean;
  };
}

// Email message from connected accounts
export interface EmailMessage {
  id: string;
  accountId: string;
  accountEmail: string;
  messageId: string; // Provider's message ID
  conversationId?: string;

  // Sender/Recipients
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;

  // Content
  subject: string;
  bodyPreview: string;
  body: string;
  bodyType: "text" | "html";

  // Metadata
  receivedAt: Date;
  sentAt?: Date;
  isRead: boolean;
  isDraft: boolean;
  importance: "low" | "normal" | "high";
  hasAttachments: boolean;
  attachments?: EmailAttachment[];

  // Folder/Category
  folder: string;
  categories?: string[];

  // Threading
  inReplyTo?: string;
  references?: string[];

  // AI Classification
  aiClassification?: AIEmailClassification;

  // Client matching
  matchedClientId?: string;
  matchedClientName?: string;
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

// AI Classification for emails
export interface AIEmailClassification {
  category: EmailTaskCategory;
  priority: "low" | "medium" | "high" | "urgent";
  confidence: number; // 0-1
  suggestedAction: SuggestedEmailAction;
  summary: string;
  keyPoints: string[];
  sentiment: "positive" | "neutral" | "negative";
  topics: string[];
  deadlineDetected?: Date;
  amountDetected?: number;
  requiresResponse: boolean;
  responseUrgency?: "immediate" | "today" | "this_week" | "whenever";
  classifiedAt: Date;
}

// Email task categories
export type EmailTaskCategory =
  | "document_request"      // Client requesting/sending documents
  | "question"              // Client asking questions
  | "payment"               // Payment related
  | "appointment"           // Scheduling/appointments
  | "tax_filing"            // Tax filing related
  | "compliance"            // Compliance/regulatory
  | "follow_up"             // Needs follow up
  | "information"           // Informational/FYI
  | "urgent"                // Marked as urgent
  | "spam"                  // Spam/promotional
  | "internal"              // Internal communication
  | "other";                // Uncategorized

// Suggested actions for emails
export type SuggestedEmailAction =
  | "respond_immediately"
  | "respond_today"
  | "schedule_call"
  | "request_documents"
  | "send_documents"
  | "create_task"
  | "forward_to_team"
  | "archive"
  | "mark_as_spam"
  | "no_action_needed";

// Email task (for the AI Email Tasks page)
export interface EmailTask {
  id: string;
  emailId: string;
  email: EmailMessage;

  // Task info
  status: "pending" | "in_progress" | "waiting" | "completed" | "snoozed";
  assignedTo?: string;
  assignedToName?: string;

  // AI suggestions
  suggestedResponse?: string;
  suggestedTemplate?: string;

  // Tracking
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  snoozedUntil?: Date;

  // Notes
  notes?: string;

  // Related
  relatedTaskIds?: string[];
  relatedClientId?: string;
}

// Email sync result
export interface EmailSyncResult {
  accountId: string;
  success: boolean;
  newEmails: number;
  updatedEmails: number;
  errors: string[];
  syncedAt: Date;
  nextSyncAt?: Date;
}

// Email filter rules
export interface EmailFilterRule {
  id: string;
  name: string;
  isEnabled: boolean;
  conditions: EmailFilterCondition[];
  conditionOperator: "and" | "or";
  actions: EmailFilterAction[];
  priority: number;
  createdAt: Date;
}

export interface EmailFilterCondition {
  field: "from" | "to" | "subject" | "body" | "hasAttachment" | "importance";
  operator: "contains" | "equals" | "startsWith" | "endsWith" | "matches";
  value: string;
  caseSensitive?: boolean;
}

export interface EmailFilterAction {
  type: "categorize" | "prioritize" | "assign" | "createTask" | "archive" | "markSpam" | "forward";
  value: string;
}

// Category display info
export const emailCategoryInfo: Record<EmailTaskCategory, { label: string; color: string; icon: string }> = {
  document_request: { label: "Document Request", color: "bg-blue-100 text-blue-700", icon: "FileText" },
  question: { label: "Question", color: "bg-purple-100 text-purple-700", icon: "HelpCircle" },
  payment: { label: "Payment", color: "bg-green-100 text-green-700", icon: "DollarSign" },
  appointment: { label: "Appointment", color: "bg-orange-100 text-orange-700", icon: "Calendar" },
  tax_filing: { label: "Tax Filing", color: "bg-red-100 text-red-700", icon: "FileCheck" },
  compliance: { label: "Compliance", color: "bg-yellow-100 text-yellow-700", icon: "Shield" },
  follow_up: { label: "Follow Up", color: "bg-pink-100 text-pink-700", icon: "Clock" },
  information: { label: "Information", color: "bg-gray-100 text-gray-700", icon: "Info" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700", icon: "AlertTriangle" },
  spam: { label: "Spam", color: "bg-gray-100 text-gray-500", icon: "Trash" },
  internal: { label: "Internal", color: "bg-indigo-100 text-indigo-700", icon: "Users" },
  other: { label: "Other", color: "bg-slate-100 text-slate-700", icon: "Mail" },
};

// Priority display info
export const emailPriorityInfo: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-red-500 text-white" },
  high: { label: "High", color: "bg-orange-500 text-white" },
  medium: { label: "Medium", color: "bg-yellow-500 text-white" },
  low: { label: "Low", color: "bg-gray-400 text-white" },
};
