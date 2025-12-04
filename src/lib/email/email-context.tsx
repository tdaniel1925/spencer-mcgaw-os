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

// Mock connected accounts
const mockConnectedAccounts: ConnectedEmailAccount[] = [
  {
    id: "acc-1",
    email: "info@spencermcgaw.com",
    displayName: "Spencer McGaw Info",
    provider: "microsoft",
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
    syncStatus: "idle",
    settings: {
      autoSync: true,
      syncIntervalMinutes: 5,
      syncFolders: ["Inbox", "Sent Items"],
      aiFilterEnabled: true,
      aiAutoClassify: true,
      aiAutoPrioritize: true,
    },
  },
  {
    id: "acc-2",
    email: "tax@spencermcgaw.com",
    displayName: "Spencer McGaw Tax",
    provider: "microsoft",
    isConnected: true,
    lastSyncAt: new Date(Date.now() - 1000 * 60 * 3),
    syncStatus: "idle",
    settings: {
      autoSync: true,
      syncIntervalMinutes: 5,
      syncFolders: ["Inbox"],
      aiFilterEnabled: true,
      aiAutoClassify: true,
      aiAutoPrioritize: true,
    },
  },
];

// Mock clients for matching
const mockClients = [
  { id: "CL001", name: "John Smith", email: "john.smith@email.com" },
  { id: "CL002", name: "ABC Corporation", email: "contact@abccorp.com" },
  { id: "CL003", name: "Sarah Johnson", email: "sarah.j@email.com" },
  { id: "CL004", name: "Tech Solutions LLC", email: "info@techsolutions.com" },
  { id: "CL005", name: "Mike Williams", email: "mike.w@consulting.com" },
];

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

// Generate mock emails
function generateMockEmails(): EmailMessage[] {
  const emails: EmailMessage[] = [
    {
      id: "em-1",
      accountId: "acc-1",
      accountEmail: "info@spencermcgaw.com",
      messageId: "msg-001",
      from: { email: "john.smith@email.com", name: "John Smith" },
      to: [{ email: "info@spencermcgaw.com", name: "Spencer McGaw" }],
      subject: "Urgent: Need W-2 forms for 2023 tax filing",
      bodyPreview: "Hi, I need to get my W-2 forms as soon as possible for my tax filing. Can you please send them over? I have a deadline coming up...",
      body: "Hi,\n\nI need to get my W-2 forms as soon as possible for my tax filing. Can you please send them over? I have a deadline coming up next week and I want to make sure everything is in order.\n\nThank you,\nJohn Smith",
      bodyType: "text",
      receivedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
      isRead: false,
      isDraft: false,
      importance: "high",
      hasAttachments: false,
      folder: "Inbox",
      matchedClientId: "CL001",
      matchedClientName: "John Smith",
    },
    {
      id: "em-2",
      accountId: "acc-2",
      accountEmail: "tax@spencermcgaw.com",
      messageId: "msg-002",
      from: { email: "contact@abccorp.com", name: "ABC Corporation" },
      to: [{ email: "tax@spencermcgaw.com", name: "Spencer McGaw Tax" }],
      subject: "Question about quarterly estimated payments",
      bodyPreview: "Hello, I have a question about our quarterly estimated tax payments. Are we on track for Q4? What is the amount we need to pay?",
      body: "Hello,\n\nI have a question about our quarterly estimated tax payments. Are we on track for Q4? What is the amount we need to pay and when is the deadline?\n\nPlease let me know at your earliest convenience.\n\nBest regards,\nABC Corporation",
      bodyType: "text",
      receivedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      isRead: false,
      isDraft: false,
      importance: "normal",
      hasAttachments: false,
      folder: "Inbox",
      matchedClientId: "CL002",
      matchedClientName: "ABC Corporation",
    },
    {
      id: "em-3",
      accountId: "acc-1",
      accountEmail: "info@spencermcgaw.com",
      messageId: "msg-003",
      from: { email: "sarah.j@email.com", name: "Sarah Johnson" },
      to: [{ email: "info@spencermcgaw.com", name: "Spencer McGaw" }],
      subject: "Schedule a call to discuss investment accounts",
      bodyPreview: "Hi, I would like to schedule a call to discuss my investment accounts and how they affect my tax situation this year...",
      body: "Hi,\n\nI would like to schedule a call to discuss my investment accounts and how they affect my tax situation this year. I've had some significant changes and want to make sure I'm handling everything correctly.\n\nWhen would be a good time to connect?\n\nThanks,\nSarah",
      bodyType: "text",
      receivedAt: new Date(Date.now() - 1000 * 60 * 90), // 1.5 hours ago
      isRead: true,
      isDraft: false,
      importance: "normal",
      hasAttachments: false,
      folder: "Inbox",
      matchedClientId: "CL003",
      matchedClientName: "Sarah Johnson",
    },
    {
      id: "em-4",
      accountId: "acc-2",
      accountEmail: "tax@spencermcgaw.com",
      messageId: "msg-004",
      from: { email: "info@techsolutions.com", name: "Tech Solutions LLC" },
      to: [{ email: "tax@spencermcgaw.com", name: "Spencer McGaw Tax" }],
      subject: "Sending bank statements for review",
      bodyPreview: "Please find attached the bank statements for Q3 and Q4. Let me know if you need anything else for the annual review.",
      body: "Hi Team,\n\nPlease find attached the bank statements for Q3 and Q4. Let me know if you need anything else for the annual review.\n\nBest,\nTech Solutions LLC",
      bodyType: "text",
      receivedAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      isRead: false,
      isDraft: false,
      importance: "normal",
      hasAttachments: true,
      attachments: [
        { id: "att-1", name: "Q3_Bank_Statement.pdf", contentType: "application/pdf", size: 245000, isInline: false },
        { id: "att-2", name: "Q4_Bank_Statement.pdf", contentType: "application/pdf", size: 267000, isInline: false },
      ],
      folder: "Inbox",
      matchedClientId: "CL004",
      matchedClientName: "Tech Solutions LLC",
    },
    {
      id: "em-5",
      accountId: "acc-1",
      accountEmail: "info@spencermcgaw.com",
      messageId: "msg-005",
      from: { email: "mike.w@consulting.com", name: "Mike Williams" },
      to: [{ email: "info@spencermcgaw.com", name: "Spencer McGaw" }],
      subject: "Invoice payment confirmation needed",
      bodyPreview: "Hi, I wanted to confirm that my payment for the December invoice has been received. Can you please verify? Amount was $2,500.",
      body: "Hi,\n\nI wanted to confirm that my payment for the December invoice has been received. Can you please verify?\n\nAmount was $2,500 paid via bank transfer on December 28th.\n\nThank you,\nMike Williams",
      bodyType: "text",
      receivedAt: new Date(Date.now() - 1000 * 60 * 180), // 3 hours ago
      isRead: true,
      isDraft: false,
      importance: "normal",
      hasAttachments: false,
      folder: "Inbox",
      matchedClientId: "CL005",
      matchedClientName: "Mike Williams",
    },
    {
      id: "em-6",
      accountId: "acc-1",
      accountEmail: "info@spencermcgaw.com",
      messageId: "msg-006",
      from: { email: "newclient@example.com", name: "New Prospect" },
      to: [{ email: "info@spencermcgaw.com", name: "Spencer McGaw" }],
      subject: "Interested in your tax services",
      bodyPreview: "Hello, I was referred to you by a colleague. I'm looking for a new accountant for my small business. Could we set up a consultation?",
      body: "Hello,\n\nI was referred to you by a colleague. I'm looking for a new accountant for my small business. Could we set up a consultation to discuss your services and pricing?\n\nLooking forward to hearing from you.\n\nBest,\nNew Prospect",
      bodyType: "text",
      receivedAt: new Date(Date.now() - 1000 * 60 * 240), // 4 hours ago
      isRead: false,
      isDraft: false,
      importance: "normal",
      hasAttachments: false,
      folder: "Inbox",
    },
    {
      id: "em-7",
      accountId: "acc-2",
      accountEmail: "tax@spencermcgaw.com",
      messageId: "msg-007",
      from: { email: "irs.notifications@irs.gov", name: "IRS Notifications" },
      to: [{ email: "tax@spencermcgaw.com", name: "Spencer McGaw Tax" }],
      subject: "Important: 2024 Tax Filing Deadline Reminder",
      bodyPreview: "This is a reminder that the 2024 tax filing deadline is approaching. Please ensure all client returns are submitted on time.",
      body: "Important Notice:\n\nThis is a reminder that the 2024 tax filing deadline is approaching. Please ensure all client returns are submitted on time to avoid penalties.\n\nKey dates:\n- Individual returns: April 15, 2024\n- Corporate returns: March 15, 2024\n\nIRS Notifications",
      bodyType: "text",
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      isRead: true,
      isDraft: false,
      importance: "high",
      hasAttachments: false,
      folder: "Inbox",
    },
    {
      id: "em-8",
      accountId: "acc-1",
      accountEmail: "info@spencermcgaw.com",
      messageId: "msg-008",
      from: { email: "john.smith@email.com", name: "John Smith" },
      to: [{ email: "info@spencermcgaw.com", name: "Spencer McGaw" }],
      subject: "Following up on my previous email",
      bodyPreview: "Hi, just following up on my previous email about the W-2 forms. Have you had a chance to send them over?",
      body: "Hi,\n\nJust following up on my previous email about the W-2 forms. Have you had a chance to send them over?\n\nThanks,\nJohn",
      bodyType: "text",
      receivedAt: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
      isRead: false,
      isDraft: false,
      importance: "high",
      hasAttachments: false,
      folder: "Inbox",
      matchedClientId: "CL001",
      matchedClientName: "John Smith",
    },
  ];

  // Add AI classification to each email
  return emails.map((email) => ({
    ...email,
    aiClassification: generateAIClassification(email),
  }));
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
  const [accounts, setAccounts] = useState<ConnectedEmailAccount[]>(mockConnectedAccounts);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailTasks, setEmailTasks] = useState<EmailTask[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize with mock data
  useEffect(() => {
    const mockEmails = generateMockEmails();
    setEmails(mockEmails);
    setEmailTasks(emailsToTasks(mockEmails));
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
