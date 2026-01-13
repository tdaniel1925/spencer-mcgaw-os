"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ConnectedEmailAccount,
  EmailMessage,
  EmailTask,
  EmailSyncResult,
  EmailTaskCategory,
} from "./types";
import { classifyEmail, EmailRelevance } from "./email-classifier";

// Extended email message with relevance info
export interface ClassifiedEmail extends EmailMessage {
  relevance: EmailRelevance;
  isBusinessRelevant: boolean;
  classificationReasons: string[];
}

// Generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Classify an email using the new classifier
function classifyAndEnrichEmail(email: Partial<EmailMessage>): {
  classification: EmailMessage["aiClassification"];
  relevance: EmailRelevance;
  isBusinessRelevant: boolean;
  reasons: string[];
} {
  const result = classifyEmail(email);
  return {
    classification: result.classification,
    relevance: result.relevance,
    isBusinessRelevant: result.isBusinessRelevant,
    reasons: result.reasons,
  };
}

// Legacy function for backwards compatibility - now uses new classifier
function generateAIClassification(email: Partial<EmailMessage>) {
  const result = classifyEmail(email);
  return result.classification;
}

// Convert emails to tasks - only include business-relevant emails
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

// Sender rule for whitelist/blacklist
export interface SenderRule {
  id: string;
  ruleType: "email" | "domain";
  matchType: "exact" | "contains" | "ends_with";
  matchValue: string;
  action: "whitelist" | "blacklist";
  reason?: string;
  isActive: boolean;
}

// Undo action for recent classification changes
export interface UndoAction {
  type: "markRelevant" | "markRejected";
  emailId: string;
  email: EmailMessage;
  timestamp: Date;
}

interface EmailContextType {
  // Connected accounts
  accounts: ConnectedEmailAccount[];
  addAccount: (account: Omit<ConnectedEmailAccount, "id">) => void;
  removeAccount: (accountId: string) => void;
  refreshAccounts: () => Promise<void>;
  updateAccountSettings: (accountId: string, settings: Partial<ConnectedEmailAccount["settings"]>) => void;

  // Emails - business relevant only
  emails: EmailMessage[];
  // Rejected emails (spam, marketing, newsletters, not relevant)
  rejectedEmails: EmailMessage[];
  getEmailsByAccount: (accountId: string) => EmailMessage[];
  getUnreadCount: (accountId?: string) => number;
  getRejectedCount: () => number;

  // Email tasks
  emailTasks: EmailTask[];
  getTasksByCategory: (category: EmailTaskCategory) => EmailTask[];
  getTasksByPriority: (priority: string) => EmailTask[];
  updateTaskStatus: (taskId: string, status: EmailTask["status"]) => void;
  assignTask: (taskId: string, userId: string, userName: string) => void;

  // Create database task from email
  createTaskFromEmail: (emailId: string, taskTitle?: string) => Promise<{ success: boolean; taskId?: string; error?: string }>;

  // Sync
  syncAccount: (accountId: string) => Promise<EmailSyncResult>;
  syncAllAccounts: () => Promise<EmailSyncResult[]>;
  isSyncing: boolean;

  // Classification actions
  reclassifyEmail: (emailId: string) => void;
  markAsRelevant: (emailId: string) => void;
  markAsRejected: (emailId: string) => void;

  // Sender rules (whitelist/blacklist)
  senderRules: SenderRule[];
  addSenderRule: (rule: Omit<SenderRule, "id">) => Promise<void>;
  removeSenderRule: (ruleId: string) => Promise<void>;

  // Undo support
  lastAction: UndoAction | null;
  undoLastAction: () => void;

  // Bulk actions
  markMultipleAsRelevant: (emailIds: string[]) => void;
  markMultipleAsRejected: (emailIds: string[]) => void;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

// Helper to save training feedback to API
async function saveTrainingFeedback(
  email: EmailMessage,
  originalClassification: "relevant" | "rejected",
  userClassification: "relevant" | "rejected"
) {
  try {
    await fetch("/api/email/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailMessageId: email.id,
        senderEmail: email.from.email,
        subject: email.subject,
        originalClassification,
        userClassification,
        originalCategory: email.aiClassification?.category,
      }),
    });
  } catch (error) {
    console.error("Failed to save training feedback:", error);
  }
}

export function EmailProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]); // Business-relevant emails only
  const [rejectedEmails, setRejectedEmails] = useState<EmailMessage[]>([]); // Spam, marketing, newsletters, etc.
  const [emailTasks, setEmailTasks] = useState<EmailTask[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [senderRules, setSenderRules] = useState<SenderRule[]>([]);
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);
  const [learnedPatterns, setLearnedPatterns] = useState<{
    whitelistedDomains: Set<string>;
    blacklistedDomains: Set<string>;
    whitelistedSenders: Set<string>;
    blacklistedSenders: Set<string>;
  }>({
    whitelistedDomains: new Set(),
    blacklistedDomains: new Set(),
    whitelistedSenders: new Set(),
    blacklistedSenders: new Set(),
  });
  const initialLoadDone = useRef(false);

  // Helper to check if an email should be overridden based on learned patterns
  const checkLearnedPatterns = useCallback((email: EmailMessage): { override: boolean; isRelevant: boolean } | null => {
    const senderEmail = email.from?.email?.toLowerCase() || "";
    const domain = senderEmail.split("@")[1] || "";

    // Check explicit sender rules first (highest priority)
    for (const rule of senderRules) {
      if (!rule.isActive) continue;

      let matches = false;
      if (rule.ruleType === "email") {
        matches = rule.matchType === "exact"
          ? senderEmail === rule.matchValue
          : senderEmail.includes(rule.matchValue);
      } else if (rule.ruleType === "domain") {
        matches = rule.matchType === "exact"
          ? domain === rule.matchValue
          : domain.includes(rule.matchValue);
      }

      if (matches) {
        return { override: true, isRelevant: rule.action === "whitelist" };
      }
    }

    // Check learned patterns from training data
    if (learnedPatterns.whitelistedSenders.has(senderEmail)) {
      return { override: true, isRelevant: true };
    }
    if (learnedPatterns.blacklistedSenders.has(senderEmail)) {
      return { override: true, isRelevant: false };
    }
    if (learnedPatterns.whitelistedDomains.has(domain)) {
      return { override: true, isRelevant: true };
    }
    if (learnedPatterns.blacklistedDomains.has(domain)) {
      return { override: true, isRelevant: false };
    }

    return null; // No override, use default classifier
  }, [senderRules, learnedPatterns]);

  // Fetch connected accounts and emails from API
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadAccountsAndEmails = async () => {
      // Wrap entire load in try-catch to prevent breaking the app
      try {
        // Fetch learned patterns from training data first
        try {
          const trainingRes = await fetch("/api/email/training");
          if (trainingRes.ok) {
            const trainingData = await trainingRes.json();
            const whitelistedDomains = new Set<string>();
            const blacklistedDomains = new Set<string>();
            const whitelistedSenders = new Set<string>();
            const blacklistedSenders = new Set<string>();

            // Process learned domains
            trainingData.learnedDomains?.forEach((d: { domain: string; action: string }) => {
              if (d.action === "whitelist") {
                whitelistedDomains.add(d.domain);
              } else {
                blacklistedDomains.add(d.domain);
              }
            });

            // Process learned senders
            trainingData.learnedSenders?.forEach((s: { email: string; action: string }) => {
              if (s.action === "whitelist") {
                whitelistedSenders.add(s.email);
              } else {
                blacklistedSenders.add(s.email);
              }
            });

            setLearnedPatterns({
              whitelistedDomains,
              blacklistedDomains,
              whitelistedSenders,
              blacklistedSenders,
            });
          }
        } catch (err) {
          console.error("Failed to load training data:", err);
        }

        // Fetch sender rules
        try {
          const rulesRes = await fetch("/api/email/sender-rules");
          if (rulesRes.ok) {
            const rulesData = await rulesRes.json();
            setSenderRules(rulesData.rules || []);
          }
        } catch (err) {
          console.error("Failed to load sender rules:", err);
        }

        // Fetch connected accounts
        const accountsRes = await fetch("/api/email/accounts");
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          if (accountsData.accounts && accountsData.accounts.length > 0) {
            setAccounts(accountsData.accounts);

            // Fetch emails for each connected account
            const inboxRes = await fetch("/api/email/inbox?folder=inbox&top=50");
            if (inboxRes.ok) {
              const inboxData = await inboxRes.json();
              if (inboxData.emails) {
                const relevantEmails: EmailMessage[] = [];
                const rejected: EmailMessage[] = [];

                // Transform and classify each email
                inboxData.emails.forEach((email: any) => {
                  const emailMessage: EmailMessage = {
                    id: email.id,
                    accountId: accountsData.accounts[0].id,
                    accountEmail: accountsData.accounts[0].email,
                    messageId: email.id,
                    from: email.from,
                    to: email.to || [],
                    subject: email.subject,
                    bodyPreview: email.preview,
                    body: email.body,
                    bodyType: email.bodyType || "html",
                    receivedAt: new Date(email.date),
                    isRead: email.isRead,
                    isDraft: false,
                    importance: email.importance || "normal",
                    hasAttachments: email.hasAttachments,
                    folder: email.folder,
                  };

                  // Classify email using the advanced classifier
                  const classificationResult = classifyAndEnrichEmail(emailMessage);
                  emailMessage.aiClassification = classificationResult.classification;

                  // Separate relevant from rejected
                  if (classificationResult.isBusinessRelevant) {
                    relevantEmails.push(emailMessage);
                  } else {
                    rejected.push(emailMessage);
                  }
                });

                setEmails(relevantEmails);
                setRejectedEmails(rejected);
                // Generate tasks only from relevant emails
                setEmailTasks(emailsToTasks(relevantEmails));
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to load emails:", error);
      }
    };

    loadAccountsAndEmails();
  }, []);

  // Add account
  const addAccount = useCallback((account: Omit<ConnectedEmailAccount, "id">) => {
    const newAccount: ConnectedEmailAccount = {
      ...account,
      id: generateId(),
    };
    setAccounts((prev) => [...prev, newAccount]);
  }, []);

  // Remove account and all associated emails/tasks
  const removeAccount = useCallback((accountId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setEmails((prev) => prev.filter((e) => e.accountId !== accountId));
    setRejectedEmails((prev) => prev.filter((e) => e.accountId !== accountId));
    setEmailTasks((prev) => prev.filter((t) => t.email.accountId !== accountId));
  }, []);

  // Refresh accounts from database - call this after connecting/disconnecting
  const refreshAccounts = useCallback(async () => {
    try {
      const accountsRes = await fetch("/api/email/accounts");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const newAccounts = accountsData.accounts || [];
        setAccounts(newAccounts);

        // Get list of valid account IDs
        const validAccountIds = new Set(newAccounts.map((a: ConnectedEmailAccount) => a.id));

        // Remove emails and tasks for disconnected accounts
        setEmails((prev) => prev.filter((e) => validAccountIds.has(e.accountId)));
        setRejectedEmails((prev) => prev.filter((e) => validAccountIds.has(e.accountId)));
        setEmailTasks((prev) => prev.filter((t) => validAccountIds.has(t.email.accountId)));

        // If there are accounts but no emails loaded, fetch them
        if (newAccounts.length > 0) {
          const inboxRes = await fetch("/api/email/inbox?folder=inbox&top=50");
          if (inboxRes.ok) {
            const inboxData = await inboxRes.json();
            if (inboxData.emails) {
              const relevantEmails: EmailMessage[] = [];
              const rejected: EmailMessage[] = [];

              // Transform and classify each email
              inboxData.emails.forEach((email: any) => {
                const emailMessage: EmailMessage = {
                  id: email.id,
                  accountId: newAccounts[0].id,
                  accountEmail: newAccounts[0].email,
                  messageId: email.id,
                  from: email.from,
                  to: email.to || [],
                  subject: email.subject,
                  bodyPreview: email.preview,
                  body: email.body,
                  bodyType: email.bodyType || "html",
                  receivedAt: new Date(email.date),
                  isRead: email.isRead,
                  isDraft: false,
                  importance: email.importance || "normal",
                  hasAttachments: email.hasAttachments,
                  folder: email.folder,
                };

                // Classify email using the advanced classifier
                const classificationResult = classifyAndEnrichEmail(emailMessage);
                emailMessage.aiClassification = classificationResult.classification;

                // Separate relevant from rejected
                if (classificationResult.isBusinessRelevant) {
                  relevantEmails.push(emailMessage);
                } else {
                  rejected.push(emailMessage);
                }
              });

              setEmails(relevantEmails);
              setRejectedEmails(rejected);
              // Generate tasks only from relevant emails
              setEmailTasks(emailsToTasks(relevantEmails));
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh accounts:", error);
    }
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

  // Get rejected email count
  const getRejectedCount = useCallback(() => rejectedEmails.length, [rejectedEmails]);

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

  // Sync account - fetches real emails from Microsoft Graph API
  const syncAccount = useCallback(async (accountId: string): Promise<EmailSyncResult> => {
    setIsSyncing(true);
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, syncStatus: "syncing" } : a))
    );

    try {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) {
        throw new Error("Account not found");
      }

      // Fetch emails from inbox
      const inboxRes = await fetch("/api/email/inbox?folder=inbox&top=50");
      if (!inboxRes.ok) {
        const errorData = await inboxRes.json();
        throw new Error(errorData.error || "Failed to fetch emails");
      }

      const inboxData = await inboxRes.json();
      const previousEmailCount = emails.filter((e) => e.accountId === accountId).length;

      if (inboxData.emails) {
        const relevantEmails: EmailMessage[] = [];
        const rejected: EmailMessage[] = [];

        // Transform and classify API emails
        inboxData.emails.forEach((email: any) => {
          const emailMessage: EmailMessage = {
            id: email.id,
            accountId: accountId,
            accountEmail: account.email,
            messageId: email.id,
            from: email.from,
            to: email.to || [],
            subject: email.subject,
            bodyPreview: email.preview,
            body: email.body,
            bodyType: email.bodyType || "html",
            receivedAt: new Date(email.date),
            isRead: email.isRead,
            isDraft: false,
            importance: email.importance || "normal",
            hasAttachments: email.hasAttachments,
            folder: email.folder,
          };

          // Classify email using the advanced classifier
          const classificationResult = classifyAndEnrichEmail(emailMessage);
          emailMessage.aiClassification = classificationResult.classification;

          // Separate relevant from rejected
          if (classificationResult.isBusinessRelevant) {
            relevantEmails.push(emailMessage);
          } else {
            rejected.push(emailMessage);
          }
        });

        // Update emails state - replace emails for this account
        setEmails((prev) => {
          const otherEmails = prev.filter((e) => e.accountId !== accountId);
          return [...otherEmails, ...relevantEmails];
        });

        // Update rejected emails state - replace rejected for this account
        setRejectedEmails((prev) => {
          const otherRejected = prev.filter((e) => e.accountId !== accountId);
          return [...otherRejected, ...rejected];
        });

        // Generate tasks from relevant emails only
        setEmailTasks(emailsToTasks(relevantEmails));

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
          newEmails: Math.max(0, relevantEmails.length - previousEmailCount),
          updatedEmails: 0,
          errors: [],
          syncedAt: new Date(),
        };
      }

      throw new Error("No emails returned from API");
    } catch (error) {
      console.error("Sync error:", error);
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? { ...a, syncStatus: "error", syncError: error instanceof Error ? error.message : "Sync failed" }
            : a
        )
      );
      setIsSyncing(false);

      return {
        accountId,
        success: false,
        newEmails: 0,
        updatedEmails: 0,
        errors: [error instanceof Error ? error.message : "Sync failed"],
        syncedAt: new Date(),
      };
    }
  }, [accounts, emails]);

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

  // Mark a rejected email as relevant (move to inbox)
  const markAsRelevant = useCallback((emailId: string) => {
    setRejectedEmails((prev) => {
      const email = prev.find((e) => e.id === emailId);
      if (email) {
        // Save undo action
        setLastAction({ type: "markRelevant", emailId, email, timestamp: new Date() });
        // Move to relevant emails
        setEmails((emails) => [...emails, email]);
        // Update tasks
        setEmailTasks((tasks) => [...tasks, ...emailsToTasks([email])]);
        // Save training feedback (async, don't block)
        saveTrainingFeedback(email, "rejected", "relevant");
      }
      return prev.filter((e) => e.id !== emailId);
    });
  }, []);

  // Mark a relevant email as rejected (move to rejected folder)
  const markAsRejected = useCallback((emailId: string) => {
    setEmails((prev) => {
      const email = prev.find((e) => e.id === emailId);
      if (email) {
        // Save undo action
        setLastAction({ type: "markRejected", emailId, email, timestamp: new Date() });
        // Move to rejected emails
        setRejectedEmails((rejected) => [...rejected, email]);
        // Remove associated tasks
        setEmailTasks((tasks) => tasks.filter((t) => t.emailId !== emailId));
        // Save training feedback (async, don't block)
        saveTrainingFeedback(email, "relevant", "rejected");
      }
      return prev.filter((e) => e.id !== emailId);
    });
  }, []);

  // Undo the last action
  const undoLastAction = useCallback(() => {
    if (!lastAction) return;

    const { type, email } = lastAction;
    if (type === "markRelevant") {
      // Move back to rejected
      setEmails((prev) => prev.filter((e) => e.id !== email.id));
      setRejectedEmails((prev) => [...prev, email]);
      setEmailTasks((tasks) => tasks.filter((t) => t.emailId !== email.id));
    } else if (type === "markRejected") {
      // Move back to relevant
      setRejectedEmails((prev) => prev.filter((e) => e.id !== email.id));
      setEmails((prev) => [...prev, email]);
      setEmailTasks((tasks) => [...tasks, ...emailsToTasks([email])]);
    }
    setLastAction(null);
  }, [lastAction]);

  // Bulk mark multiple emails as relevant
  const markMultipleAsRelevant = useCallback((emailIds: string[]) => {
    emailIds.forEach((id) => {
      setRejectedEmails((prev) => {
        const email = prev.find((e) => e.id === id);
        if (email) {
          setEmails((emails) => [...emails, email]);
          setEmailTasks((tasks) => [...tasks, ...emailsToTasks([email])]);
          saveTrainingFeedback(email, "rejected", "relevant");
        }
        return prev.filter((e) => e.id !== id);
      });
    });
  }, []);

  // Bulk mark multiple emails as rejected
  const markMultipleAsRejected = useCallback((emailIds: string[]) => {
    emailIds.forEach((id) => {
      setEmails((prev) => {
        const email = prev.find((e) => e.id === id);
        if (email) {
          setRejectedEmails((rejected) => [...rejected, email]);
          setEmailTasks((tasks) => tasks.filter((t) => t.emailId !== id));
          saveTrainingFeedback(email, "relevant", "rejected");
        }
        return prev.filter((e) => e.id !== id);
      });
    });
  }, []);

  // Add a sender rule (whitelist/blacklist)
  const addSenderRule = useCallback(async (rule: Omit<SenderRule, "id">) => {
    try {
      const res = await fetch("/api/email/sender-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (res.ok) {
        const data = await res.json();
        setSenderRules((prev) => [...prev, data.rule]);
      }
    } catch (error) {
      console.error("Failed to add sender rule:", error);
    }
  }, []);

  // Remove a sender rule
  const removeSenderRule = useCallback(async (ruleId: string) => {
    try {
      const res = await fetch(`/api/email/sender-rules?id=${ruleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSenderRules((prev) => prev.filter((r) => r.id !== ruleId));
      }
    } catch (error) {
      console.error("Failed to remove sender rule:", error);
    }
  }, []);

  // Create a database task from an email
  const createTaskFromEmail = useCallback(async (
    emailId: string,
    taskTitle?: string
  ): Promise<{ success: boolean; taskId?: string; error?: string }> => {
    // Find the email
    const email = emails.find((e) => e.id === emailId);
    if (!email) {
      return { success: false, error: "Email not found" };
    }

    // Generate a task title if not provided
    const title = taskTitle || `Follow up: ${email.subject}`;

    // Map email priority to task priority
    const priorityMap: Record<string, string> = {
      urgent: "urgent",
      high: "high",
      normal: "medium",
      low: "low",
    };
    const priority = priorityMap[email.aiClassification?.priority || "normal"] || "medium";

    // Calculate due date based on response urgency
    let dueDate: string | null = null;
    if (email.aiClassification?.responseUrgency) {
      const today = new Date();
      switch (email.aiClassification.responseUrgency) {
        case "immediate":
          dueDate = today.toISOString();
          break;
        case "today":
          today.setHours(23, 59, 59, 999);
          dueDate = today.toISOString();
          break;
        case "this_week":
          const endOfWeek = new Date(today);
          endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
          dueDate = endOfWeek.toISOString();
          break;
      }
    } else if (email.aiClassification?.deadlineDetected) {
      dueDate = new Date(email.aiClassification.deadlineDetected).toISOString();
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: email.aiClassification?.summary || email.bodyPreview,
          priority,
          status: "pending",
          source: "email",
          source_id: email.id,
          due_date: dueDate,
          client_name: email.from.name || email.from.email,
          tags: email.aiClassification?.topics || [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update the email task to link to the database task
        setEmailTasks((prev) =>
          prev.map((t) =>
            t.emailId === emailId
              ? { ...t, relatedTaskIds: [...(t.relatedTaskIds || []), data.task.id] }
              : t
          )
        );
        return { success: true, taskId: data.task.id };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || "Failed to create task" };
      }
    } catch (error) {
      console.error("Failed to create task from email:", error);
      return { success: false, error: "Failed to create task" };
    }
  }, [emails]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      accounts,
      addAccount,
      removeAccount,
      refreshAccounts,
      updateAccountSettings,
      emails,
      rejectedEmails,
      getEmailsByAccount,
      getUnreadCount,
      getRejectedCount,
      emailTasks,
      getTasksByCategory,
      getTasksByPriority,
      updateTaskStatus,
      assignTask,
      createTaskFromEmail,
      syncAccount,
      syncAllAccounts,
      isSyncing,
      reclassifyEmail,
      markAsRelevant,
      markAsRejected,
      senderRules,
      addSenderRule,
      removeSenderRule,
      lastAction,
      undoLastAction,
      markMultipleAsRelevant,
      markMultipleAsRejected,
    }),
    [
      accounts,
      addAccount,
      removeAccount,
      refreshAccounts,
      updateAccountSettings,
      emails,
      rejectedEmails,
      getEmailsByAccount,
      getUnreadCount,
      getRejectedCount,
      emailTasks,
      getTasksByCategory,
      getTasksByPriority,
      updateTaskStatus,
      assignTask,
      createTaskFromEmail,
      syncAccount,
      syncAllAccounts,
      isSyncing,
      reclassifyEmail,
      markAsRelevant,
      markAsRejected,
      senderRules,
      addSenderRule,
      removeSenderRule,
      lastAction,
      undoLastAction,
      markMultipleAsRelevant,
      markMultipleAsRejected,
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
