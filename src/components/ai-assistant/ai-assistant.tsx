"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// App knowledge base - comprehensive help for every feature
const appKnowledge = {
  // General app info
  general: {
    name: "Spencer McGaw Business OS",
    description: "A comprehensive business management platform for accounting and professional services firms. It helps you manage clients, tasks, emails, documents, calendar, and phone calls all in one place.",
  },

  // Page-specific help
  pages: {
    "/dashboard": {
      name: "Dashboard",
      description: "Your home base showing a quick overview of your day.",
      features: [
        "See your personalized greeting based on the time of day",
        "View upcoming tasks and deadlines",
        "Check recent activity across the system",
        "Quick access to important metrics",
      ],
      tips: [
        "The dashboard updates automatically to show your most relevant information",
        "Click on any card to dive deeper into that section",
      ],
    },
    "/tasks": {
      name: "Tasks",
      description: "Manage all your to-do items and work assignments.",
      features: [
        "Create new tasks with titles, descriptions, and due dates",
        "Assign tasks to yourself or team members",
        "Set priority levels (low, medium, high, urgent)",
        "Filter tasks by status, priority, or assignee",
        "Mark tasks as complete when finished",
      ],
      tips: [
        "Use the filter buttons at the top to quickly find specific tasks",
        "Click on a task to see full details and edit it",
        "Overdue tasks are highlighted in red",
      ],
    },
    "/email": {
      name: "AI Email Tasks",
      description: "A smart email management system that uses AI to help you process emails efficiently.",
      features: [
        "Emails are organized in a kanban board with columns: New, In Progress, Waiting on Client, Completed",
        "The first column has two tabs: Qualified (important emails) and Rejected (filtered out)",
        "AI automatically analyzes each email and suggests action items",
        "Four quick action buttons on each email card:",
        "  - Approve (blue thumbs up): Move to In Progress, this email needs work",
        "  - Reject (red thumbs down): Mark as not relevant, used to train the AI filter",
        "  - Keep (green checkmark): Stay in Qualified, but no tasks needed",
        "  - Delete (trash): Remove from the system entirely",
        "Drag and drop emails between columns to change their status",
        "Click on an email to see the full details, AI summary, and action items",
        "Attachments can be saved to your Hub folder",
        "Calendar events can be added directly from emails",
      ],
      tips: [
        "Use the Train button to teach the AI filter by analyzing your sent emails",
        "Select multiple emails and use bulk actions to process them faster",
        "The AI generates specific tasks from each email like 'Send Tax Return' instead of generic summaries",
        "Expand the Full Email section to see the original email content",
      ],
    },
    "/calls": {
      name: "AI Phone Agent",
      description: "View and manage phone calls handled by the AI phone agent.",
      features: [
        "See a log of all incoming and outgoing calls",
        "Listen to call recordings",
        "View AI-generated call summaries and transcripts",
        "Track follow-up actions from calls",
      ],
      tips: [
        "Click on a call to see the full transcript",
        "The AI automatically creates tasks from important calls",
      ],
    },
    "/clients": {
      name: "Clients",
      description: "Manage your client database and relationships.",
      features: [
        "View all clients in a searchable list",
        "Add new clients with contact information",
        "See client details including associated tasks, documents, and emails",
        "Track client status and important dates",
        "Link emails and tasks to specific clients",
      ],
      tips: [
        "Use the search bar to quickly find clients by name or email",
        "Click Add Client to create a new client record",
        "Client pages show all related activity in one place",
      ],
    },
    "/documents": {
      name: "Documents",
      description: "Store and organize files and documents.",
      features: [
        "Upload and store documents securely",
        "Organize documents by client or category",
        "Search for documents by name or content",
        "Preview documents without downloading",
      ],
      tips: [
        "Drag and drop files to upload quickly",
        "Use folders to keep documents organized",
      ],
    },
    "/analytics": {
      name: "Analytics",
      description: "View reports and insights about your business performance.",
      features: [
        "See task completion rates and trends",
        "Track email response times",
        "Monitor team productivity",
        "View client engagement metrics",
      ],
      tips: [
        "Use date filters to compare different time periods",
        "Export reports for presentations",
      ],
    },
    "/calendar": {
      name: "Calendar",
      description: "Manage your schedule and appointments.",
      features: [
        "View events in day, week, or month view",
        "Create new appointments and meetings",
        "Sync with your Microsoft or Google calendar",
        "See deadlines from tasks on your calendar",
      ],
      tips: [
        "Click on a time slot to quickly create an event",
        "Drag events to reschedule them",
      ],
    },
    "/activity": {
      name: "Activity Log",
      description: "See a timeline of all actions taken in the system.",
      features: [
        "Track who did what and when",
        "Filter by user, action type, or date",
        "See detailed information about each action",
      ],
      tips: [
        "Use this to audit changes or find when something was modified",
      ],
    },
    "/settings": {
      name: "Settings",
      description: "Configure your personal preferences and account.",
      features: [
        "Update your profile information",
        "Change your password",
        "Configure notification preferences",
        "Manage connected accounts",
      ],
      tips: [
        "Keep your profile up to date for better team collaboration",
      ],
    },
    "/help": {
      name: "Help and Guides",
      description: "Find documentation and tutorials.",
      features: [
        "Browse help articles by topic",
        "Search for specific questions",
        "View video tutorials",
      ],
      tips: [
        "You can also ask me questions anytime by clicking the AI Assistant tab",
      ],
    },
    "/admin/users": {
      name: "User Management",
      description: "Manage team members and their access levels. Admin only.",
      features: [
        "Add new team members",
        "Assign roles: Owner, Admin, Staff, or Viewer",
        "Deactivate or remove users",
        "See when users last logged in",
      ],
      tips: [
        "Staff members can do most tasks but cannot access admin settings",
        "Viewers have read-only access",
      ],
    },
    "/admin/audit": {
      name: "Audit Trail",
      description: "View detailed logs of all system actions. Admin only.",
      features: [
        "See every action taken by every user",
        "Filter by action type, user, or date range",
        "Export audit logs for compliance",
      ],
      tips: [
        "Use this for security reviews or investigating issues",
      ],
    },
    "/admin/system": {
      name: "System Settings",
      description: "Configure system-wide settings. Admin only.",
      features: [
        "Connect email accounts (Microsoft 365, Outlook)",
        "Configure AI settings",
        "Manage integrations",
        "View system status",
      ],
      tips: [
        "Email connection requires Microsoft 365 admin consent for your organization",
      ],
    },
  },

  // Common questions and answers
  commonQuestions: [
    {
      keywords: ["add", "create", "new", "client"],
      answer: "To add a new client, go to the Clients page from the sidebar and click the 'Add Client' button in the top right. Fill in their name, email, and any other relevant information, then click Save.",
    },
    {
      keywords: ["connect", "email", "microsoft", "outlook"],
      answer: "To connect your email, go to System Settings (you need admin access) and click 'Connect Email' under the Email Integration section. You will be redirected to Microsoft to sign in and authorize the connection.",
    },
    {
      keywords: ["task", "create", "add", "new"],
      answer: "To create a new task, go to the Tasks page and click 'New Task'. Give it a title, description, set the due date, priority, and optionally assign it to a team member. Click Save when done.",
    },
    {
      keywords: ["email", "approve", "reject", "process"],
      answer: "When processing emails, you have four options. Approve (blue thumbs up) moves it to In Progress for work. Reject (red thumbs down) marks it as not relevant and helps train the AI. Keep (green checkmark) leaves it in Qualified but marks no tasks needed. Delete removes it entirely.",
    },
    {
      keywords: ["drag", "drop", "move", "column"],
      answer: "You can drag and drop emails between kanban columns to change their status. Just click and hold on an email card, then drag it to the column you want and release.",
    },
    {
      keywords: ["calendar", "add", "event", "schedule"],
      answer: "To add a calendar event, go to the Calendar page and click on the time slot where you want the event, or click the 'New Event' button. Fill in the details and save.",
    },
    {
      keywords: ["password", "change", "reset"],
      answer: "To change your password, go to Settings from the user menu in the sidebar. There you will find the option to update your password.",
    },
    {
      keywords: ["role", "permission", "access"],
      answer: "There are four roles. Owner has full access to everything. Admin can manage users and system settings. Staff can manage clients, tasks, and emails but cannot access admin features. Viewer has read-only access to most features.",
    },
    {
      keywords: ["ai", "filter", "train", "learn"],
      answer: "The AI email filter learns from your actions. When you reject emails, it learns what is not relevant. Use the Train button to analyze your sent emails and automatically whitelist domains you communicate with regularly.",
    },
    {
      keywords: ["attachment", "save", "hub", "file"],
      answer: "When viewing an email, you can save attachments to your Hub folder by clicking the 'Save to Hub' button next to each attachment. This stores the file in your documents section.",
    },
    {
      keywords: ["bulk", "select", "multiple"],
      answer: "To select multiple emails, use the checkboxes on each email card. A toolbar will appear at the top with bulk actions like mark as relevant, mark as rejected, archive, or delete.",
    },
    {
      keywords: ["search", "find", "look"],
      answer: "Most pages have a search bar at the top. Type what you are looking for and the results will filter automatically. You can search clients, tasks, documents, and more.",
    },
  ],
};

// Generate response based on user question
function generateResponse(question: string, currentPage: string): string {
  const q = question.toLowerCase().trim();

  // Greeting responses
  if (q.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
    return "Hello! I am your AI Assistant. I can help you with any questions about how to use this app. What would you like to know?";
  }

  // What can you do?
  if (q.includes("what can you do") || q.includes("how can you help") || q.includes("what do you do")) {
    return "I can help you understand how to use every feature in this app. Just ask me questions like 'How do I add a client?' or 'What does the Reject button do?' and I will explain in plain English. I also know what page you are on, so you can ask 'What can I do here?' for context-specific help.";
  }

  // Current page help
  if (q.includes("what is this page") || q.includes("what can i do here") || q.includes("help with this page") || q.includes("how does this page work")) {
    const pageInfo = appKnowledge.pages[currentPage as keyof typeof appKnowledge.pages];
    if (pageInfo) {
      let response = `You are on the ${pageInfo.name} page. ${pageInfo.description}\n\nHere is what you can do:\n`;
      pageInfo.features.forEach((feature, i) => {
        response += `${i + 1}. ${feature}\n`;
      });
      if (pageInfo.tips && pageInfo.tips.length > 0) {
        response += `\nTip: ${pageInfo.tips[0]}`;
      }
      return response;
    }
    return "I do not have specific information about this page, but I am happy to answer any questions you have about the app.";
  }

  // Check common questions
  for (const qa of appKnowledge.commonQuestions) {
    const matches = qa.keywords.filter(kw => q.includes(kw));
    if (matches.length >= 2 || (matches.length === 1 && q.split(" ").length <= 4)) {
      return qa.answer;
    }
  }

  // Check if asking about a specific page
  for (const [path, pageInfo] of Object.entries(appKnowledge.pages)) {
    const pageName = pageInfo.name.toLowerCase();
    if (q.includes(pageName) || q.includes(path.replace("/", "").replace("/", " "))) {
      let response = `The ${pageInfo.name} page lets you ${pageInfo.description.toLowerCase()}\n\nMain features:\n`;
      pageInfo.features.slice(0, 4).forEach((feature, i) => {
        response += `${i + 1}. ${feature}\n`;
      });
      if (pageInfo.tips && pageInfo.tips.length > 0) {
        response += `\nTip: ${pageInfo.tips[0]}`;
      }
      return response;
    }
  }

  // Navigation help
  if (q.includes("where") || q.includes("find") || q.includes("go to") || q.includes("navigate")) {
    if (q.includes("client")) return "You can find clients in the sidebar. Click on 'Clients' to see your client list, or 'Add Client' to create a new one.";
    if (q.includes("task")) return "Tasks are in the sidebar. Click on 'Tasks' to see all your to-do items and manage them.";
    if (q.includes("email")) return "Email management is under 'AI Email Tasks' in the sidebar. This is where you process and organize your emails.";
    if (q.includes("calendar")) return "The Calendar is in the sidebar. Click it to view and manage your schedule.";
    if (q.includes("setting")) return "Settings are in the user menu at the bottom of the sidebar. Click your profile picture and select 'Edit Profile'.";
    if (q.includes("document")) return "Documents are in the sidebar. Click 'Documents' to upload and manage your files.";
  }

  // Default fallback
  return "I am not sure I understand that question. Try asking things like:\n- What can I do on this page?\n- How do I add a client?\n- What does the Approve button do?\n- How do I connect my email?\n\nI am here to help you learn the app!";
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  // Initial greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const pageInfo = appKnowledge.pages[pathname as keyof typeof appKnowledge.pages];
      const greeting = pageInfo
        ? `Hello! I am your AI Assistant. You are currently on the ${pageInfo.name} page. Ask me anything about how to use this app, or type "What can I do here?" to learn about this page.`
        : "Hello! I am your AI Assistant. Ask me anything about how to use this app and I will help you in plain English.";

      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: greeting,
        },
      ]);
    }
  }, [isOpen, messages.length, pathname]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate typing delay for more natural feel
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    const response = generateResponse(userMessage.content, pathname);

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response,
    };

    setIsTyping(false);
    setMessages((prev) => [...prev, assistantMessage]);
  };

  return (
    <>
      {/* Floating Tab Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-300",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "animate-pulse-subtle",
          isOpen && "opacity-0 pointer-events-none"
        )}
        aria-label="Open AI Assistant"
      >
        <Bot className="h-5 w-5" />
        <span className="font-medium text-sm">AI Assistant</span>
      </button>

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] bg-background border rounded-2xl shadow-2xl flex flex-col transition-all duration-300 overflow-hidden",
          isOpen ? "opacity-100 translate-y-0 h-[500px]" : "opacity-0 translate-y-4 h-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-sm">AI Assistant</h3>
              <p className="text-xs text-muted-foreground">Here to help</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1"
              disabled={isTyping}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isTyping}>
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
