"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import {
  ConnectedEmailAccount,
  EmailMessage,
  EmailTask,
  EmailSyncResult,
  AIEmailClassification,
  EmailTaskCategory,
} from "./types";

// Generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Empty accounts - real data comes from connected OAuth accounts

// Generate AI classification
function generateAIClassification(email: Partial<EmailMessage>): AIEmailClassification {
  const subject = email.subject?.toLowerCase() || "";
  const body = email.bodyPreview?.toLowerCase() || "";
  const combined = subject + " " + body;

  // Determine category based on keywords
  let category: EmailTaskCategory = "other";
  let priority: "low" | "medium" | "high" | "urgent" = "medium";
  let suggestedAction: AIEmailClassification["suggestedAction"] = "respond_today";
  let requiresResponse = true;

  if (combined.includes("urgent") || combined.includes("asap") || combined.includes("immediately")) {
    category = "urgent";
    priority = "urgent";
    suggestedAction = "respond_immediately";
  } else if (combined.includes("document") || combined.includes("w-2") || combined.includes("1099") || combined.includes("tax return") || combined.includes("send") || combined.includes("attach")) {
    category = "document_request";
    priority = "high";
    suggestedAction = "request_documents";
  } else if (combined.includes("question") || combined.includes("?") || combined.includes("wondering") || combined.includes("can you")) {
    category = "question";
    priority = "medium";
    suggestedAction = "respond_today";
  } else if (combined.includes("payment") || combined.includes("invoice") || combined.includes("pay") || combined.includes("$") || combined.includes("amount")) {
    category = "payment";
    priority = "high";
    suggestedAction = "respond_today";
  } else if (combined.includes("appointment") || combined.includes("schedule") || combined.includes("meeting") || combined.includes("call")) {
    category = "appointment";
    priority = "medium";
    suggestedAction = "schedule_call";
  } else if (combined.includes("tax") || combined.includes("filing") || combined.includes("irs") || combined.includes("return")) {
    category = "tax_filing";
    priority = "high";
    suggestedAction = "create_task";
  } else if (combined.includes("compliance") || combined.includes("regulation") || combined.includes("deadline")) {
    category = "compliance";
    priority = "high";
    suggestedAction = "create_task";
  } else if (combined.includes("follow up") || combined.includes("following up") || combined.includes("checking in")) {
    category = "follow_up";
    priority = "medium";
    suggestedAction = "respond_today";
  } else if (combined.includes("fyi") || combined.includes("for your information") || combined.includes("just letting")) {
    category = "information";
    priority = "low";
    requiresResponse = false;
    suggestedAction = "archive";
  }

  // Generate summary and key points
  const summaries: Record<EmailTaskCategory, string> = {
    document_request: "Client is requesting or sending documents",
    question: "Client has questions that need answers",
    payment: "Payment or billing related inquiry",
    appointment: "Scheduling or meeting request",
    tax_filing: "Tax filing or IRS related matter",
    compliance: "Compliance or regulatory deadline",
    follow_up: "Follow-up on previous communication",
    information: "Informational message, no action needed",
    urgent: "Urgent matter requiring immediate attention",
    spam: "Promotional or spam content",
    internal: "Internal team communication",
    other: "General inquiry",
  };

  return {
    category,
    priority,
    confidence: 0.85 + Math.random() * 0.1,
    suggestedAction,
    summary: summaries[category],
    keyPoints: [
      `Category: ${category.replace("_", " ")}`,
      `Priority: ${priority}`,
      requiresResponse ? "Requires response" : "No response needed",
    ],
    sentiment: combined.includes("thank") || combined.includes("appreciate") ? "positive" : "neutral",
    topics: [category.replace("_", " ")],
    requiresResponse,
    responseUrgency: priority === "urgent" ? "immediate" : priority === "high" ? "today" : "this_week",
    classifiedAt: new Date(),
  };
}


// Convert emails to tasks
function emailsToTasks(emails: EmailMessage[]): EmailTask[] {
  return emails
    .filter((email) => !email.isRead || email.aiClassification?.requiresResponse)
    .map((email) => ({
      id: `task-${email.id}`,
      emailId: email.id,
      email,
      status: email.isRead ? "in_progress" : "pending",
      createdAt: email.receivedAt,
      updatedAt: new Date(),
      relatedClientId: email.matchedClientId,
    }));
}

interface EmailContextType {
  // Connected accounts
  accounts: ConnectedEmailAccount[];
  addAccount: (account: Omit<ConnectedEmailAccount, "id">) => void;
  removeAccount: (accountId: string) => void;
  updateAccountSettings: (accountId: string, settings: Partial<ConnectedEmailAccount["settings"]>) => void;

  // Emails
  emails: EmailMessage[];
  getEmailsByAccount: (accountId: string) => EmailMessage[];
  getUnreadCount: (accountId?: string) => number;

  // Email tasks
  emailTasks: EmailTask[];
  getTasksByCategory: (category: EmailTaskCategory) => EmailTask[];
  getTasksByPriority: (priority: string) => EmailTask[];
  updateTaskStatus: (taskId: string, status: EmailTask["status"]) => void;
  assignTask: (taskId: string, userId: string, userName: string) => void;

  // Sync
  syncAccount: (accountId: string) => Promise<EmailSyncResult>;
  syncAllAccounts: () => Promise<EmailSyncResult[]>;
  isSyncing: boolean;

  // Filters
  reclassifyEmail: (emailId: string) => void;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export function EmailProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailTasks, setEmailTasks] = useState<EmailTask[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize with empty state - real data comes from connected accounts
  useEffect(() => {
    setEmails([]);
    setEmailTasks([]);
  }, []);

  // Add account
  const addAccount = useCallback((account: Omit<ConnectedEmailAccount, "id">) => {
    const newAccount: ConnectedEmailAccount = {
      ...account,
      id: generateId(),
    };
    setAccounts((prev) => [...prev, newAccount]);
  }, []);

  // Remove account
  const removeAccount = useCallback((accountId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setEmails((prev) => prev.filter((e) => e.accountId !== accountId));
  }, []);

  // Update account settings
  const updateAccountSettings = useCallback(
    (accountId: string, settings: Partial<ConnectedEmailAccount["settings"]>) => {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? { ...a, settings: { ...a.settings, ...settings } }
            : a
        )
      );
    },
    []
  );

  // Get emails by account
  const getEmailsByAccount = useCallback(
    (accountId: string) => emails.filter((e) => e.accountId === accountId),
    [emails]
  );

  // Get unread count
  const getUnreadCount = useCallback(
    (accountId?: string) =>
      emails.filter((e) => !e.isRead && (!accountId || e.accountId === accountId)).length,
    [emails]
  );

  // Get tasks by category
  const getTasksByCategory = useCallback(
    (category: EmailTaskCategory) =>
      emailTasks.filter((t) => t.email.aiClassification?.category === category),
    [emailTasks]
  );

  // Get tasks by priority
  const getTasksByPriority = useCallback(
    (priority: string) =>
      emailTasks.filter((t) => t.email.aiClassification?.priority === priority),
    [emailTasks]
  );

  // Update task status
  const updateTaskStatus = useCallback((taskId: string, status: EmailTask["status"]) => {
    setEmailTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              updatedAt: new Date(),
              completedAt: status === "completed" ? new Date() : undefined,
            }
          : t
      )
    );
  }, []);

  // Assign task
  const assignTask = useCallback((taskId: string, userId: string, userName: string) => {
    setEmailTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, assignedTo: userId, assignedToName: userName, updatedAt: new Date() }
          : t
      )
    );
  }, []);

  // Sync account (mock implementation)
  const syncAccount = useCallback(async (accountId: string): Promise<EmailSyncResult> => {
    setIsSyncing(true);
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, syncStatus: "syncing" } : a))
    );

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId
          ? { ...a, syncStatus: "idle", lastSyncAt: new Date() }
          : a
      )
    );
    setIsSyncing(false);

    return {
      accountId,
      success: true,
      newEmails: Math.floor(Math.random() * 5),
      updatedEmails: Math.floor(Math.random() * 3),
      errors: [],
      syncedAt: new Date(),
    };
  }, []);

  // Sync all accounts
  const syncAllAccounts = useCallback(async (): Promise<EmailSyncResult[]> => {
    const results: EmailSyncResult[] = [];
    for (const account of accounts) {
      const result = await syncAccount(account.id);
      results.push(result);
    }
    return results;
  }, [accounts, syncAccount]);

  // Reclassify email
  const reclassifyEmail = useCallback((emailId: string) => {
    setEmails((prev) =>
      prev.map((e) =>
        e.id === emailId
          ? { ...e, aiClassification: generateAIClassification(e) }
          : e
      )
    );
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      accounts,
      addAccount,
      removeAccount,
      updateAccountSettings,
      emails,
      getEmailsByAccount,
      getUnreadCount,
      emailTasks,
      getTasksByCategory,
      getTasksByPriority,
      updateTaskStatus,
      assignTask,
      syncAccount,
      syncAllAccounts,
      isSyncing,
      reclassifyEmail,
    }),
    [
      accounts,
      addAccount,
      removeAccount,
      updateAccountSettings,
      emails,
      getEmailsByAccount,
      getUnreadCount,
      emailTasks,
      getTasksByCategory,
      getTasksByPriority,
      updateTaskStatus,
      assignTask,
      syncAccount,
      syncAllAccounts,
      isSyncing,
      reclassifyEmail,
    ]
  );

  return (
    <EmailContext.Provider value={contextValue}>
      {children}
    </EmailContext.Provider>
  );
}

export function useEmail() {
  const context = useContext(EmailContext);
  if (context === undefined) {
    throw new Error("useEmail must be used within an EmailProvider");
  }
  return context;
}
