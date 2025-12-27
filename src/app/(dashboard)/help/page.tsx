"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  BookOpen,
  HelpCircle,
  Phone,
  Mail,
  Calendar,
  Users,
  Bot,
  Settings,
  Shield,
  Zap,
  ExternalLink,
  ChevronRight,
  Clock,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Star,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  Printer,
  ClipboardList,
  FolderOpen,
  BarChart3,
  UserCog,
  Key,
  Bell,
  FileText,
  Activity,
} from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/onboarding-provider";

// Types
interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  readTime: number;
  lastUpdated: string;
  featured?: boolean;
  content: ArticleSection[];
}

interface ArticleSection {
  type: "paragraph" | "heading" | "list" | "code" | "tip" | "warning" | "steps";
  content: string | string[];
}

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  articleCount: number;
}

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

// Categories
const categories: Category[] = [
  {
    id: "getting-started",
    name: "Getting Started",
    icon: <BookOpen className="h-5 w-5" />,
    description: "Learn the basics of Spencer McGaw Hub",
    articleCount: 5,
  },
  {
    id: "tasks",
    name: "Tasks & Workflow",
    icon: <ClipboardList className="h-5 w-5" />,
    description: "Managing tasks, the task pool, and team tasks",
    articleCount: 4,
  },
  {
    id: "clients",
    name: "Client Management",
    icon: <Users className="h-5 w-5" />,
    description: "Managing clients, contacts, and client data",
    articleCount: 3,
  },
  {
    id: "email",
    name: "Email & Inbox",
    icon: <Mail className="h-5 w-5" />,
    description: "Email integration and AI email processing",
    articleCount: 4,
  },
  {
    id: "calls",
    name: "Phone & AI Agent",
    icon: <Phone className="h-5 w-5" />,
    description: "Phone integration and VAPI AI agent",
    articleCount: 3,
  },
  {
    id: "files",
    name: "Files & Documents",
    icon: <FolderOpen className="h-5 w-5" />,
    description: "File management and document storage",
    articleCount: 2,
  },
  {
    id: "admin",
    name: "Administration",
    icon: <Settings className="h-5 w-5" />,
    description: "User management, roles, and system settings",
    articleCount: 5,
  },
  {
    id: "security",
    name: "Security & Privacy",
    icon: <Shield className="h-5 w-5" />,
    description: "Security features, permissions, and privacy",
    articleCount: 3,
  },
];

// Knowledge Base Articles
const articles: Article[] = [
  // Getting Started
  {
    id: "quick-start-guide",
    title: "Quick Start Guide",
    description: "Get up and running with Spencer McGaw Hub in minutes",
    category: "getting-started",
    tags: ["basics", "setup", "introduction"],
    readTime: 5,
    lastUpdated: "2024-12-27",
    featured: true,
    content: [
      { type: "paragraph", content: "Welcome to Spencer McGaw Hub! This comprehensive guide will help you get started with the platform quickly and efficiently." },
      { type: "heading", content: "Step 1: Complete Your Profile" },
      { type: "paragraph", content: "Navigate to Settings from the sidebar to customize your profile. You can add your name, upload a profile photo, set your department, and configure your notification preferences." },
      { type: "steps", content: [
        "Click on your profile picture in the bottom-left of the sidebar",
        "Select 'Edit Profile' from the dropdown menu",
        "Fill in your full name, job title, and department",
        "Upload a profile photo (optional but recommended)",
        "Save your changes"
      ]},
      { type: "heading", content: "Step 2: Understand the Navigation" },
      { type: "paragraph", content: "The sidebar is organized into clear sections to help you find what you need:" },
      { type: "list", content: [
        "Dashboard - Your overview with key metrics and recent activity",
        "My Work - Your personal inbox, tasks, and calendar",
        "Organization - Shared resources like Org Feed, Task Pool, Team Tasks, and Chat",
        "Business - Clients, Projects, and Files",
        "Admin - For administrators: Oversight, User Management, and System Settings"
      ]},
      { type: "heading", content: "Step 3: Explore Key Features" },
      { type: "paragraph", content: "Take time to explore each area. Click 'Getting Started' in your profile menu anytime to rewatch the onboarding tour." },
      { type: "tip", content: "Pro tip: Use keyboard shortcuts to navigate faster. Press '?' anywhere to see available shortcuts." },
    ],
  },
  {
    id: "understanding-dashboard",
    title: "Understanding Your Dashboard",
    description: "Learn how to read and use your dashboard effectively",
    category: "getting-started",
    tags: ["dashboard", "navigation", "overview"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "The dashboard is your command center, providing a quick overview of everything that needs your attention." },
      { type: "heading", content: "Dashboard Components" },
      { type: "list", content: [
        "Summary Cards - Show key statistics like active clients, pending tasks, and recent calls",
        "Recent Activity - A feed of the latest actions across the organization",
        "Upcoming Events - Your next scheduled meetings and deadlines",
        "Quick Actions - Shortcuts to common tasks like adding clients or creating tasks"
      ]},
      { type: "heading", content: "Reading the Metrics" },
      { type: "paragraph", content: "Each metric card shows current values compared to previous periods. Green indicators mean improvement, while red indicates areas that may need attention." },
      { type: "tip", content: "Click on any metric card to see detailed breakdowns and historical trends." },
    ],
  },
  {
    id: "navigation-structure",
    title: "Navigation Structure Explained",
    description: "Understanding My Work vs Organization sections",
    category: "getting-started",
    tags: ["navigation", "structure", "layout"],
    readTime: 3,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "The navigation is split into personal and organizational sections to help you focus on what matters." },
      { type: "heading", content: "My Work Section" },
      { type: "paragraph", content: "This section contains items that are specifically assigned to you or that you've claimed:" },
      { type: "list", content: [
        "My Inbox - Emails assigned to you or requiring your attention",
        "My Tasks - Tasks you've created, been assigned, or claimed from the pool",
        "My Calendar - Your personal schedule and appointments"
      ]},
      { type: "heading", content: "Organization Section" },
      { type: "paragraph", content: "These are shared resources visible to the whole team (based on permissions):" },
      { type: "list", content: [
        "Org Feed - A combined feed of all calls and global emails coming into the organization",
        "Task Pool - Unassigned tasks that anyone can claim",
        "Team Tasks - View all team members' tasks (managers/admins only)",
        "Chat - Team communication and collaboration"
      ]},
      { type: "tip", content: "The Organization section promotes transparency - everyone can see what's happening across the firm." },
    ],
  },
  {
    id: "first-login",
    title: "First Login & Onboarding",
    description: "What happens when you first log in",
    category: "getting-started",
    tags: ["login", "onboarding", "first-time"],
    readTime: 2,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "When you first log in to Spencer McGaw Hub, you'll be greeted with an interactive onboarding tour that introduces you to the key features." },
      { type: "heading", content: "The Onboarding Experience" },
      { type: "list", content: [
        "Welcome screen with an overview of the platform",
        "Guided tour of the main navigation areas",
        "Introduction to key features like tasks, clients, and the org feed",
        "Tips for getting the most out of the system"
      ]},
      { type: "heading", content: "Restarting the Tour" },
      { type: "paragraph", content: "If you'd like to see the onboarding tour again:" },
      { type: "steps", content: [
        "Click on your profile picture in the sidebar",
        "Select 'Getting Started' from the dropdown menu",
        "The onboarding tour will restart"
      ]},
    ],
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    description: "Navigate faster with keyboard shortcuts",
    category: "getting-started",
    tags: ["keyboard", "shortcuts", "productivity"],
    readTime: 2,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Use keyboard shortcuts to navigate the platform more efficiently." },
      { type: "heading", content: "Global Shortcuts" },
      { type: "list", content: [
        "? - Show keyboard shortcuts help",
        "Ctrl/Cmd + K - Open quick search",
        "G then D - Go to Dashboard",
        "G then T - Go to Tasks",
        "G then C - Go to Clients"
      ]},
      { type: "heading", content: "Task Shortcuts" },
      { type: "list", content: [
        "N - New task",
        "E - Edit selected task",
        "D - Mark as done",
        "Esc - Close dialog/panel"
      ]},
      { type: "tip", content: "Press '?' at any time to see all available shortcuts for the current page." },
    ],
  },

  // Tasks & Workflow
  {
    id: "task-management",
    title: "Task Management Overview",
    description: "Understanding how tasks work in Spencer McGaw Hub",
    category: "tasks",
    tags: ["tasks", "workflow", "management"],
    readTime: 6,
    lastUpdated: "2024-12-27",
    featured: true,
    content: [
      { type: "paragraph", content: "Tasks are the core of your daily workflow. They can be created manually, generated from emails, or created from phone calls." },
      { type: "heading", content: "Task Sources" },
      { type: "list", content: [
        "Manual - Created directly by you or a team member",
        "Email - Generated from incoming emails that require action",
        "Phone Call - Created from call summaries and action items",
        "Document Intake - Generated when new documents are received"
      ]},
      { type: "heading", content: "Task States" },
      { type: "list", content: [
        "Pending - Not yet started",
        "In Progress - Currently being worked on",
        "Completed - Finished",
        "Cancelled - No longer needed"
      ]},
      { type: "heading", content: "Task Assignment" },
      { type: "paragraph", content: "Tasks can be assigned in two ways:" },
      { type: "list", content: [
        "Direct Assignment - An admin or manager assigns a task to a specific person",
        "Claiming - A staff member claims an unassigned task from the Task Pool"
      ]},
      { type: "tip", content: "Unassigned tasks appear in the Org Tasks (Task Pool) where any team member can claim them." },
    ],
  },
  {
    id: "task-pool",
    title: "Using the Task Pool (Org Tasks)",
    description: "How to work with the organization-wide task pool",
    category: "tasks",
    tags: ["task-pool", "claiming", "unassigned"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "The Task Pool (found under 'Task Pool' in the Organization section) shows all unassigned tasks that anyone can claim." },
      { type: "heading", content: "Viewing the Task Pool" },
      { type: "paragraph", content: "The Task Pool displays tasks in a Kanban-style board organized by priority:" },
      { type: "list", content: [
        "Urgent - Must be handled immediately",
        "High - Should be addressed today",
        "Medium - Standard priority",
        "Low - Can wait if needed"
      ]},
      { type: "heading", content: "Claiming a Task" },
      { type: "steps", content: [
        "Browse the Task Pool to find a task you can handle",
        "Click on the task to see details",
        "Click the 'Claim Task' button",
        "The task moves to your personal task list"
      ]},
      { type: "warning", content: "Once you claim a task, you're responsible for completing it. Only claim tasks you can actually work on." },
    ],
  },
  {
    id: "team-tasks",
    title: "Team Tasks View (Managers)",
    description: "How managers can view and manage team workloads",
    category: "tasks",
    tags: ["team", "management", "oversight"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "The Team Tasks view (available to managers and admins) provides visibility into all team members' assigned tasks." },
      { type: "heading", content: "Accessing Team Tasks" },
      { type: "paragraph", content: "Go to Organization > Team Tasks in the sidebar. You'll see:" },
      { type: "list", content: [
        "Grid View - Tasks grouped by team member, showing each person's workload",
        "List View - All tasks in a sortable list with assignee information"
      ]},
      { type: "heading", content: "Using the View" },
      { type: "list", content: [
        "Filter by team member to see a specific person's tasks",
        "Filter by status to see only active or completed tasks",
        "Filter by priority to focus on urgent items",
        "Click any task to see details and make changes"
      ]},
      { type: "tip", content: "Use this view in team meetings to review workloads and redistribute tasks if someone is overloaded." },
    ],
  },
  {
    id: "creating-tasks",
    title: "Creating and Editing Tasks",
    description: "How to create tasks manually",
    category: "tasks",
    tags: ["create", "edit", "tasks"],
    readTime: 3,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "While many tasks are created automatically from emails and calls, you can also create tasks manually." },
      { type: "heading", content: "Creating a New Task" },
      { type: "steps", content: [
        "Go to My Tasks or use the + button",
        "Click 'New Task' or 'Add Task'",
        "Enter a clear, descriptive title",
        "Add a description with any relevant details",
        "Set the priority level",
        "Optionally set a due date",
        "Optionally link to a client",
        "Click 'Create' to save"
      ]},
      { type: "heading", content: "Editing Tasks" },
      { type: "paragraph", content: "Click on any task to open the detail panel. From there you can:" },
      { type: "list", content: [
        "Update the title and description",
        "Change the status",
        "Adjust priority",
        "Set or change the due date",
        "Link or unlink a client",
        "Add comments and notes"
      ]},
    ],
  },

  // Client Management
  {
    id: "adding-clients",
    title: "Adding and Managing Clients",
    description: "How to add new clients and manage existing ones",
    category: "clients",
    tags: ["clients", "contacts", "management"],
    readTime: 5,
    lastUpdated: "2024-12-27",
    featured: true,
    content: [
      { type: "paragraph", content: "Clients are at the heart of your business. Spencer McGaw Hub makes it easy to track all client information and interactions." },
      { type: "heading", content: "Adding a New Client" },
      { type: "steps", content: [
        "Go to Clients from the sidebar",
        "Click 'Add Client' in the top right",
        "Enter the client's first and last name",
        "Add contact information (email, phone)",
        "Optionally add address and additional details",
        "Select the service type(s) they need",
        "Click 'Create Client'"
      ]},
      { type: "heading", content: "Client Information" },
      { type: "paragraph", content: "Each client record can include:" },
      { type: "list", content: [
        "Personal Information - Name, email, phone, address",
        "Business Information - Company name, EIN, business type",
        "Service Types - Tax preparation, bookkeeping, payroll, etc.",
        "Documents - Uploaded files and tax documents",
        "Notes - Internal notes about the client",
        "Activity History - All interactions and task history"
      ]},
      { type: "tip", content: "Keep client records updated - the AI uses this information to match incoming emails and calls to the right client." },
    ],
  },
  {
    id: "client-matching",
    title: "Automatic Client Matching",
    description: "How the system matches emails and calls to clients",
    category: "clients",
    tags: ["matching", "ai", "automation"],
    readTime: 3,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Spencer McGaw Hub automatically attempts to match incoming emails and phone calls to existing clients." },
      { type: "heading", content: "How Matching Works" },
      { type: "list", content: [
        "Email Address - Emails are matched to clients with the same email address",
        "Phone Number - Calls are matched to clients with the same phone number",
        "Name Recognition - AI attempts to match based on names in the email signature or call transcript"
      ]},
      { type: "heading", content: "When No Match is Found" },
      { type: "paragraph", content: "If no match is found, the system will:" },
      { type: "list", content: [
        "Flag the item as 'Unmatched'",
        "Display sender/caller information for manual matching",
        "Allow you to create a new client from the contact information"
      ]},
      { type: "tip", content: "Ensure all client phone numbers and emails are entered correctly to improve automatic matching accuracy." },
    ],
  },
  {
    id: "client-privacy",
    title: "Client Data Privacy",
    description: "Managing sensitive client information",
    category: "clients",
    tags: ["privacy", "sensitive", "security"],
    readTime: 3,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Client data security is critical, especially for accounting firms handling sensitive financial information." },
      { type: "heading", content: "Sensitive Data Fields" },
      { type: "paragraph", content: "The following fields are treated as sensitive and have restricted access:" },
      { type: "list", content: [
        "Social Security Numbers (SSN)",
        "Employer Identification Numbers (EIN)",
        "Bank account information",
        "Financial statements"
      ]},
      { type: "heading", content: "Access Control" },
      { type: "paragraph", content: "Only users with the 'clients:view_sensitive' permission can see sensitive data. By default:" },
      { type: "list", content: [
        "Owners, Admins, Managers, and Accountants can view sensitive data",
        "Staff members see masked/hidden sensitive fields",
        "Viewers cannot see sensitive information at all"
      ]},
      { type: "warning", content: "Never share client sensitive data outside the system. All access is logged for compliance." },
    ],
  },

  // Email
  {
    id: "email-integration",
    title: "Email Integration Setup",
    description: "How to connect your email accounts",
    category: "email",
    tags: ["email", "integration", "microsoft", "google"],
    readTime: 5,
    lastUpdated: "2024-12-27",
    featured: true,
    content: [
      { type: "paragraph", content: "Spencer McGaw Hub can connect to Microsoft 365 and Google Workspace to sync your emails." },
      { type: "heading", content: "Connecting an Email Account" },
      { type: "paragraph", content: "Email integration is configured by administrators in Admin > System Settings > Integrations." },
      { type: "steps", content: [
        "Go to Admin > System Settings > Integrations",
        "Find the Email Integration section",
        "Click 'Connect Account'",
        "Choose Microsoft 365 or Google Workspace",
        "Sign in with your email credentials",
        "Grant the necessary permissions",
        "Your emails will start syncing"
      ]},
      { type: "heading", content: "What Gets Synced" },
      { type: "list", content: [
        "Incoming emails are synced and processed by AI",
        "Emails are categorized and prioritized automatically",
        "Client matching is attempted for each email",
        "Action items are extracted when relevant"
      ]},
      { type: "warning", content: "Email integration requires admin permissions. Contact your administrator if you need access." },
    ],
  },
  {
    id: "ai-email-processing",
    title: "AI Email Processing",
    description: "How the AI analyzes and categorizes your emails",
    category: "email",
    tags: ["ai", "email", "automation", "classification"],
    readTime: 6,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Our AI email processing automatically analyzes incoming emails to categorize them, extract key information, and prioritize your inbox." },
      { type: "heading", content: "How It Works" },
      { type: "list", content: [
        "Emails are automatically scanned upon receipt",
        "AI identifies the category (document request, question, payment, etc.)",
        "Priority level is assigned based on content and urgency",
        "Key points and a summary are extracted",
        "Action items are identified and can become tasks",
        "Client matching is attempted automatically"
      ]},
      { type: "heading", content: "Email Categories" },
      { type: "list", content: [
        "Document Request - Client asking for documents",
        "Document Submission - Client sending documents",
        "Question - Client asking a question",
        "Payment - Payment-related correspondence",
        "Scheduling - Meeting or appointment requests",
        "Urgent - Time-sensitive matters",
        "General - Other correspondence"
      ]},
      { type: "heading", content: "Priority Levels" },
      { type: "list", content: [
        "Urgent - Requires immediate attention (deadlines, complaints)",
        "High - Important but not immediate",
        "Medium - Standard priority",
        "Low - Can be addressed when time permits"
      ]},
      { type: "tip", content: "The AI learns from your actions over time. Consistently processing emails helps improve accuracy." },
    ],
  },
  {
    id: "my-inbox",
    title: "Using My Inbox",
    description: "How to work with your personal email inbox",
    category: "email",
    tags: ["inbox", "email", "personal"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "My Inbox shows emails that are specifically assigned to you or need your attention." },
      { type: "heading", content: "Inbox Features" },
      { type: "list", content: [
        "AI-generated summaries for quick scanning",
        "Priority indicators for at-a-glance triage",
        "Client matching shows which client the email is from",
        "Quick actions to create tasks, reply, or archive"
      ]},
      { type: "heading", content: "Processing Emails" },
      { type: "paragraph", content: "For each email you can:" },
      { type: "list", content: [
        "Create Task - Turn the email into an actionable task",
        "Reply - Send a response directly",
        "Link to Client - Manually link if not auto-matched",
        "Archive - Remove from inbox when handled",
        "Mark as Spam - Report and hide spam emails"
      ]},
    ],
  },
  {
    id: "org-feed",
    title: "Understanding the Org Feed",
    description: "How the organization-wide feed works",
    category: "email",
    tags: ["org-feed", "calls", "emails", "organization"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "The Org Feed provides a combined view of all incoming calls and global emails across the organization." },
      { type: "heading", content: "What Appears in the Org Feed" },
      { type: "list", content: [
        "All incoming phone calls with summaries and transcripts",
        "Emails from organization-wide accounts (like info@ addresses)",
        "AI-generated summaries and categorization",
        "Client matching information",
        "Task creation status"
      ]},
      { type: "heading", content: "Using the Org Feed" },
      { type: "paragraph", content: "The Org Feed is designed for team visibility. You can:" },
      { type: "list", content: [
        "Filter by type (calls only, emails only, or all)",
        "See which items already have tasks created",
        "Create tasks from items that need action",
        "Click through to see full details"
      ]},
      { type: "tip", content: "Check the Org Feed regularly to stay aware of what's coming into the organization." },
    ],
  },

  // Phone & Calls
  {
    id: "phone-integration",
    title: "Phone System Integration",
    description: "How phone calls are tracked in the system",
    category: "calls",
    tags: ["phone", "calls", "integration", "twilio"],
    readTime: 5,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Spencer McGaw Hub integrates with your phone system to log calls, record conversations, and generate transcripts and summaries." },
      { type: "heading", content: "Call Tracking Features" },
      { type: "list", content: [
        "Automatic call logging with caller information",
        "Call recording (if enabled in your phone system)",
        "AI-powered transcription of conversations",
        "AI summary with key points and action items",
        "Automatic client matching based on phone number"
      ]},
      { type: "heading", content: "How Calls Appear in the System" },
      { type: "paragraph", content: "Incoming calls are processed and appear in:" },
      { type: "list", content: [
        "Org Feed - All calls appear here for organization visibility",
        "Client Record - Calls matched to clients appear in their activity history",
        "Tasks - Action items from calls can become tasks"
      ]},
      { type: "warning", content: "Call recording must be enabled and configured in your phone system (Twilio/VAPI) to get transcripts." },
    ],
  },
  {
    id: "ai-phone-agent",
    title: "AI Phone Agent (VAPI)",
    description: "Understanding the AI-powered phone assistant",
    category: "calls",
    tags: ["ai", "vapi", "phone", "assistant", "agent"],
    readTime: 6,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "The AI Phone Agent, powered by VAPI, can handle incoming calls, answer common questions, and take messages when staff are unavailable." },
      { type: "heading", content: "What the AI Agent Can Do" },
      { type: "list", content: [
        "Answer calls with a professional greeting",
        "Handle common questions about business hours, location, services",
        "Take detailed messages including caller information",
        "Attempt to schedule appointments (if calendar is connected)",
        "Transfer to a human when the AI can't help"
      ]},
      { type: "heading", content: "Configuration" },
      { type: "paragraph", content: "The AI agent is configured in Admin > System Settings. Administrators can:" },
      { type: "list", content: [
        "Set operating hours for AI answering",
        "Customize the greeting and voice",
        "Configure knowledge base content",
        "Set transfer rules and fallback numbers"
      ]},
      { type: "tip", content: "The AI agent is billed per minute of usage. Monitor costs in the Admin > Analytics section." },
    ],
  },
  {
    id: "phone-webhooks",
    title: "Setting Up Phone Webhooks",
    description: "Configure webhooks for phone call integration",
    category: "calls",
    tags: ["webhooks", "phone", "twilio", "vapi", "integration"],
    readTime: 5,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Phone webhooks allow Spencer McGaw Hub to receive real-time notifications about phone calls from your phone provider." },
      { type: "heading", content: "Available Webhooks" },
      { type: "list", content: [
        "Inbound Call Webhook - Triggered when a call comes in",
        "Call Completed Webhook - Receives call summary and recording",
        "Voicemail Webhook - Handles voicemail notifications",
        "VAPI Event Webhook - For AI agent interactions"
      ]},
      { type: "heading", content: "Configuration Steps" },
      { type: "steps", content: [
        "Go to Admin > System Settings > Integrations",
        "Find the 'Phone Call Webhooks' section",
        "Copy the webhook URL for each type you need",
        "In your Twilio or VAPI dashboard, paste these URLs",
        "Configure authentication using the webhook secret provided",
        "Test the connection using the test button"
      ]},
      { type: "warning", content: "Keep your webhook secret secure - it's used to verify incoming requests are legitimate." },
    ],
  },

  // Files & Documents
  {
    id: "file-management",
    title: "File Management",
    description: "Uploading and organizing files",
    category: "files",
    tags: ["files", "documents", "upload", "storage"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "The Files section allows you to upload, organize, and share documents with your team." },
      { type: "heading", content: "Uploading Files" },
      { type: "steps", content: [
        "Go to Files from the sidebar",
        "Click 'Upload' or drag files into the window",
        "Select files from your computer",
        "Optionally link files to a client",
        "Add tags or categories for organization",
        "Click 'Upload' to save"
      ]},
      { type: "heading", content: "File Organization" },
      { type: "list", content: [
        "Filter by client to see all files for a specific client",
        "Filter by type (PDF, image, spreadsheet, etc.)",
        "Search by filename or content",
        "Sort by upload date, name, or size"
      ]},
      { type: "tip", content: "Link files to clients when uploading - this makes them easily accessible from the client record." },
    ],
  },
  {
    id: "document-intake",
    title: "Document Intake Process",
    description: "How documents create tasks automatically",
    category: "files",
    tags: ["documents", "intake", "automation", "tasks"],
    readTime: 3,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "When documents are received (via email attachments or direct upload), the system can automatically create tasks." },
      { type: "heading", content: "Automatic Task Creation" },
      { type: "list", content: [
        "Tax documents received create a 'Review documents' task",
        "Signed forms create a 'Process signed documents' task",
        "Financial statements trigger relevant review tasks"
      ]},
      { type: "heading", content: "Document Processing" },
      { type: "paragraph", content: "The AI analyzes documents to:" },
      { type: "list", content: [
        "Identify document type (W-2, 1099, bank statement, etc.)",
        "Extract key information (dates, amounts, names)",
        "Match to the appropriate client",
        "Create relevant tasks with context"
      ]},
    ],
  },

  // Administration
  {
    id: "user-management",
    title: "User Management",
    description: "Adding, editing, and managing team members",
    category: "admin",
    tags: ["users", "team", "management", "admin"],
    readTime: 5,
    lastUpdated: "2024-12-27",
    featured: true,
    content: [
      { type: "paragraph", content: "Administrators can manage team members in Admin > User Management." },
      { type: "heading", content: "Adding a New User" },
      { type: "steps", content: [
        "Go to Admin > User Management",
        "Click 'Add User'",
        "Enter the user's email address",
        "Enter their full name",
        "Create a temporary password",
        "Select their role (Staff, Manager, Admin, etc.)",
        "Optionally set department and job title",
        "Click 'Create User'"
      ]},
      { type: "heading", content: "What Happens Next" },
      { type: "list", content: [
        "User receives a welcome email with their login credentials",
        "They can log in immediately with the provided password",
        "On first login, they see the onboarding tour",
        "They should change their password after first login"
      ]},
      { type: "tip", content: "Use strong, unique passwords for new accounts and encourage users to change them immediately." },
    ],
  },
  {
    id: "user-roles",
    title: "User Roles and Permissions",
    description: "Understanding role-based access control",
    category: "admin",
    tags: ["roles", "permissions", "access", "rbac"],
    readTime: 6,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Spencer McGaw Hub uses role-based access control (RBAC) to manage what users can see and do." },
      { type: "heading", content: "Available Roles" },
      { type: "list", content: [
        "Owner - Full access including billing and system administration",
        "Admin - Full access except billing; can manage users and settings",
        "Manager - Team management, client oversight, and reporting",
        "Accountant - Financial data access, client documents, and reporting",
        "Staff - Standard access to tasks, clients, and daily operations",
        "Viewer - Read-only access for auditing"
      ]},
      { type: "heading", content: "Permission Categories" },
      { type: "list", content: [
        "Dashboard - View dashboard, analytics, revenue data",
        "Tasks - View, create, edit, delete, assign, view all",
        "Clients - View, create, edit, delete, view sensitive data, export",
        "Calls - View, make, view recordings, manage AI agent",
        "Email - View, send, manage rules, connect accounts",
        "Documents - View, upload, download, delete, manage rules",
        "Settings - View, edit profile, manage integrations, billing",
        "Users - View, create, edit, delete, manage roles",
        "System - View audit logs, manage API keys, backup/restore"
      ]},
      { type: "tip", content: "Use the 'Permission Overrides' feature to grant or revoke specific permissions for individual users." },
    ],
  },
  {
    id: "permission-overrides",
    title: "Permission Overrides",
    description: "Customizing permissions for individual users",
    category: "admin",
    tags: ["permissions", "overrides", "custom"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Permission overrides allow you to grant or revoke specific permissions for individual users, beyond their role's default permissions." },
      { type: "heading", content: "How Overrides Work" },
      { type: "list", content: [
        "Overrides are applied on top of role permissions",
        "You can grant permissions not normally in the role",
        "You can revoke permissions that are normally included",
        "Overrides can be temporary (with expiration dates)"
      ]},
      { type: "heading", content: "Adding an Override" },
      { type: "steps", content: [
        "Go to Admin > User Management",
        "Find and click on the user",
        "Click the 'Permissions' tab",
        "Click 'Add Override'",
        "Select the permission to override",
        "Choose 'Grant' or 'Revoke'",
        "Optionally set an expiration date",
        "Save the override"
      ]},
      { type: "warning", content: "Overrides are powerful - use them sparingly and document why each override exists." },
    ],
  },
  {
    id: "system-settings",
    title: "System Settings Overview",
    description: "Configuring system-wide settings",
    category: "admin",
    tags: ["settings", "system", "configuration"],
    readTime: 5,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "System settings control organization-wide configurations. Access them via Admin > System Settings." },
      { type: "heading", content: "Available Settings" },
      { type: "list", content: [
        "Organization Details - Company name, address, contact info",
        "Integrations - Email, phone, calendar connections",
        "API Keys - Twilio, OpenAI, Resend, and other service keys",
        "Webhooks - Incoming webhook URLs and secrets",
        "Notifications - System-wide notification preferences",
        "Security - Password policies, session timeouts"
      ]},
      { type: "heading", content: "Integration Settings" },
      { type: "paragraph", content: "Each integration has its own configuration:" },
      { type: "list", content: [
        "Email - Microsoft 365 or Google Workspace credentials",
        "Phone - Twilio account SID and auth token",
        "AI Agent - VAPI API key and agent configuration",
        "Sending Emails - Resend API key"
      ]},
      { type: "warning", content: "Changing integration settings may temporarily disrupt services. Plan changes during low-activity periods." },
    ],
  },
  {
    id: "audit-logs",
    title: "Audit Logs and Activity Tracking",
    description: "Monitoring system activity for compliance",
    category: "admin",
    tags: ["audit", "logs", "compliance", "tracking"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "All significant actions in Spencer McGaw Hub are logged for compliance and troubleshooting." },
      { type: "heading", content: "What Gets Logged" },
      { type: "list", content: [
        "User logins and logouts",
        "Client record creates, updates, and deletes",
        "Task status changes and assignments",
        "File uploads and downloads",
        "Permission changes",
        "System setting changes"
      ]},
      { type: "heading", content: "Viewing Audit Logs" },
      { type: "steps", content: [
        "Go to Admin > Audit Trail",
        "Use filters to narrow by date, user, or action type",
        "Click on any entry to see full details",
        "Export logs if needed for compliance"
      ]},
      { type: "tip", content: "Regularly review audit logs to ensure proper system usage and identify potential issues early." },
    ],
  },

  // Security & Privacy
  {
    id: "data-security",
    title: "Data Security",
    description: "How we protect your sensitive data",
    category: "security",
    tags: ["security", "encryption", "protection"],
    readTime: 4,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Spencer McGaw Hub is built with security as a priority, especially important for accounting firms handling sensitive financial data." },
      { type: "heading", content: "Security Measures" },
      { type: "list", content: [
        "Encryption at Rest - All data is encrypted using AES-256",
        "Encryption in Transit - All connections use TLS 1.3",
        "Access Control - Role-based permissions restrict data access",
        "Audit Logging - All actions are logged for compliance",
        "Session Management - Automatic timeouts and secure sessions"
      ]},
      { type: "heading", content: "Data Location" },
      { type: "paragraph", content: "Data is stored in secure cloud infrastructure with:" },
      { type: "list", content: [
        "Regular automated backups",
        "Geographic redundancy",
        "SOC 2 compliant data centers",
        "24/7 monitoring and alerting"
      ]},
    ],
  },
  {
    id: "password-security",
    title: "Password and Account Security",
    description: "Best practices for account security",
    category: "security",
    tags: ["password", "account", "security"],
    readTime: 3,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "Protecting your account starts with a strong password and good security practices." },
      { type: "heading", content: "Password Requirements" },
      { type: "list", content: [
        "Minimum 8 characters",
        "At least one uppercase letter",
        "At least one lowercase letter",
        "At least one number",
        "At least one special character"
      ]},
      { type: "heading", content: "Best Practices" },
      { type: "list", content: [
        "Use a unique password not used on other sites",
        "Change your password every 90 days",
        "Never share your password with anyone",
        "Log out when using shared computers",
        "Report any suspicious activity immediately"
      ]},
      { type: "tip", content: "Consider using a password manager to generate and store strong, unique passwords." },
    ],
  },
  {
    id: "privacy-settings",
    title: "Privacy Settings",
    description: "Controlling what others can see",
    category: "security",
    tags: ["privacy", "visibility", "settings"],
    readTime: 3,
    lastUpdated: "2024-12-27",
    content: [
      { type: "paragraph", content: "By default, Spencer McGaw Hub promotes transparency with an 'everyone sees everything' model. However, privacy controls are available." },
      { type: "heading", content: "Visibility Model" },
      { type: "paragraph", content: "In the organization:" },
      { type: "list", content: [
        "All team members can see Org Feed, Task Pool, and Chat",
        "Personal tasks and inbox are visible to managers/admins",
        "Sensitive client data is restricted by permission",
        "Audit logs are admin-only"
      ]},
      { type: "heading", content: "Privacy Controls" },
      { type: "paragraph", content: "Users can request privacy settings adjustments through their administrator. Options include:" },
      { type: "list", content: [
        "Hiding from the task pool assignee list",
        "Limiting visibility of calendar details",
        "Restricting access to sensitive documents"
      ]},
      { type: "tip", content: "The transparency model helps accounting teams collaborate effectively. Privacy restrictions should be the exception, not the rule." },
    ],
  },
];

// FAQs
const faqs: FAQ[] = [
  // Getting Started
  {
    question: "How do I reset my password?",
    answer: "Click 'Forgot Password' on the login page and enter your email. You'll receive a reset link. If you're logged in, go to Settings > Security to change your password.",
    category: "getting-started",
  },
  {
    question: "How do I see the onboarding tour again?",
    answer: "Click on your profile picture in the bottom-left of the sidebar, then select 'Getting Started' from the dropdown menu. This will restart the onboarding tour.",
    category: "getting-started",
  },
  {
    question: "What's the difference between My Tasks and Task Pool?",
    answer: "My Tasks shows tasks assigned to you or that you've claimed. Task Pool shows unassigned tasks that anyone in the organization can claim and work on.",
    category: "tasks",
  },
  {
    question: "How do I claim a task from the Task Pool?",
    answer: "Go to Organization > Task Pool, find a task you can handle, click on it to see details, then click the 'Claim Task' button. The task will move to your personal task list.",
    category: "tasks",
  },
  {
    question: "Can I unclaim a task I claimed by mistake?",
    answer: "Yes, open the task details and click 'Unclaim' or 'Return to Pool'. The task will go back to the Task Pool for others to claim.",
    category: "tasks",
  },
  {
    question: "How does the AI categorize emails?",
    answer: "The AI analyzes email content, subject, and sender to categorize emails (document request, question, payment, etc.) and assign priority levels. It improves over time based on your actions.",
    category: "email",
  },
  {
    question: "Why wasn't an email matched to a client?",
    answer: "Emails are matched by email address or phone number. If the sender's email isn't in any client record, it won't match. You can manually link emails to clients, and we recommend keeping client contact info up to date.",
    category: "email",
  },
  {
    question: "How do I connect my email account?",
    answer: "Email integration is set up by administrators. Go to Admin > System Settings > Integrations and follow the prompts to connect Microsoft 365 or Google Workspace.",
    category: "email",
  },
  {
    question: "What is the Org Feed?",
    answer: "The Org Feed is a combined view of all incoming calls and global emails across your organization. It provides transparency so everyone can see what's coming in.",
    category: "email",
  },
  {
    question: "How do phone calls get logged?",
    answer: "Phone calls are logged automatically via webhooks from your phone provider (Twilio or VAPI). Call recordings and AI-generated summaries appear in the system shortly after each call ends.",
    category: "calls",
  },
  {
    question: "What does the AI Phone Agent do?",
    answer: "The VAPI-powered AI Phone Agent can answer calls, respond to common questions, take messages, and even schedule appointments when staff are unavailable. It's configured in Admin > System Settings.",
    category: "calls",
  },
  {
    question: "How do I add a new team member?",
    answer: "Go to Admin > User Management and click 'Add User'. Enter their email, name, a temporary password, and select their role. They'll receive a welcome email with login instructions.",
    category: "admin",
  },
  {
    question: "What are the different user roles?",
    answer: "Roles include Owner (full access), Admin (everything except billing), Manager (team oversight), Accountant (financial focus), Staff (daily operations), and Viewer (read-only). Each has different permissions.",
    category: "admin",
  },
  {
    question: "Can I give a user extra permissions beyond their role?",
    answer: "Yes, use Permission Overrides. Go to Admin > User Management, select the user, go to the Permissions tab, and add an override to grant or revoke specific permissions.",
    category: "admin",
  },
  {
    question: "How do I view audit logs?",
    answer: "Go to Admin > Audit Trail. You can filter by date, user, or action type. All significant actions (logins, data changes, permission changes) are logged.",
    category: "admin",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We use role-based access control, audit logging, and secure cloud infrastructure with regular backups.",
    category: "security",
  },
  {
    question: "Who can see sensitive client data like SSNs?",
    answer: "Only users with the 'clients:view_sensitive' permission can see sensitive data. By default, this includes Owners, Admins, Managers, and Accountants. Staff members see masked values.",
    category: "security",
  },
  {
    question: "How do I upload files for a client?",
    answer: "Go to Files, click Upload, select files, and link them to the client. Alternatively, go to the client's record and use the Documents tab to upload directly.",
    category: "files",
  },
  {
    question: "Can clients access the system?",
    answer: "Currently, Spencer McGaw Hub is for internal team use only. A client portal feature is planned for the future.",
    category: "clients",
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [activeTab, setActiveTab] = useState("knowledge-base");
  const { triggerOnboarding } = useOnboarding();

  // Filter articles based on search and category
  const filteredArticles = useMemo(() => {
    let result = articles;

    if (selectedCategory) {
      result = result.filter((a) => a.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    return result;
  }, [searchQuery, selectedCategory]);

  // Filter FAQs based on search
  const filteredFAQs = useMemo(() => {
    if (!searchQuery) return faqs;
    const query = searchQuery.toLowerCase();
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(query) ||
        f.answer.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Featured articles
  const featuredArticles = articles.filter((a) => a.featured);

  // Render article content
  const renderArticleContent = (article: Article) => {
    return (
      <div className="space-y-4">
        {article.content.map((section, idx) => {
          switch (section.type) {
            case "paragraph":
              return (
                <p key={idx} className="text-muted-foreground leading-relaxed">
                  {section.content as string}
                </p>
              );
            case "heading":
              return (
                <h3 key={idx} className="text-lg font-semibold mt-6 mb-2">
                  {section.content as string}
                </h3>
              );
            case "list":
              return (
                <ul key={idx} className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                  {(section.content as string[]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              );
            case "steps":
              return (
                <ol key={idx} className="space-y-2">
                  {(section.content as string[]).map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              );
            case "tip":
              return (
                <div key={idx} className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                  <Lightbulb className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {section.content as string}
                  </p>
                </div>
              );
            case "warning":
              return (
                <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {section.content as string}
                  </p>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  };

  return (
    <>
      <Header title="Help & Support" />
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Hero Section */}
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-8">
                <h1 className="text-3xl font-bold mb-2">How can we help you?</h1>
                <p className="text-muted-foreground mb-6">
                  Search our knowledge base or browse topics below
                </p>
                <div className="relative max-w-xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search for articles, guides, or FAQs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 text-base"
                  />
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="knowledge-base" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Knowledge Base
                  </TabsTrigger>
                  <TabsTrigger value="faqs" className="gap-2">
                    <HelpCircle className="h-4 w-4" />
                    FAQs
                  </TabsTrigger>
                  <TabsTrigger value="contact" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Contact Support
                  </TabsTrigger>
                </TabsList>

                {/* Knowledge Base Tab */}
                <TabsContent value="knowledge-base" className="space-y-6">
                  {selectedArticle ? (
                    // Article View
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedArticle(null)}
                          >
                            <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                            Back to articles
                          </Button>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon">
                              <Bookmark className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{selectedArticle.category.replace("-", " ")}</Badge>
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {selectedArticle.readTime} min read
                            </span>
                          </div>
                          <CardTitle className="text-2xl">{selectedArticle.title}</CardTitle>
                          <CardDescription className="text-base mt-2">
                            {selectedArticle.description}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {renderArticleContent(selectedArticle)}

                        <Separator className="my-8" />

                        {/* Article Feedback */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium mb-1">Was this article helpful?</p>
                            <p className="text-sm text-muted-foreground">
                              Your feedback helps us improve our documentation
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Yes
                            </Button>
                            <Button variant="outline" size="sm">
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              No
                            </Button>
                          </div>
                        </div>

                        {/* Related Articles */}
                        <div className="mt-8">
                          <h3 className="font-semibold mb-4">Related Articles</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {articles
                              .filter(
                                (a) =>
                                  a.id !== selectedArticle.id &&
                                  a.category === selectedArticle.category
                              )
                              .slice(0, 2)
                              .map((article) => (
                                <Card
                                  key={article.id}
                                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => setSelectedArticle(article)}
                                >
                                  <CardContent className="p-4">
                                    <h4 className="font-medium">{article.title}</h4>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {article.description}
                                    </p>
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Featured Articles */}
                      {!searchQuery && !selectedCategory && (
                        <div>
                          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Star className="h-5 w-5 text-amber-500" />
                            Featured Articles
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {featuredArticles.map((article) => (
                              <Card
                                key={article.id}
                                className="cursor-pointer hover:shadow-md transition-all"
                                onClick={() => setSelectedArticle(article)}
                              >
                                <CardHeader className="pb-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {article.category.replace("-", " ")}
                                    </Badge>
                                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                                      Featured
                                    </Badge>
                                  </div>
                                  <CardTitle className="text-base">{article.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {article.description}
                                  </p>
                                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {article.readTime} min
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Categories Grid */}
                      {!searchQuery && !selectedCategory && (
                        <div>
                          <h2 className="text-lg font-semibold mb-4">Browse by Topic</h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {categories.map((category) => (
                              <Card
                                key={category.id}
                                className="cursor-pointer hover:shadow-md transition-all"
                                onClick={() => setSelectedCategory(category.id)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                      {category.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-semibold text-sm">{category.name}</h3>
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                        {category.description}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Category View or Search Results */}
                      {(selectedCategory || searchQuery) && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              {selectedCategory && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedCategory(null)}
                                >
                                  <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                                  All Topics
                                </Button>
                              )}
                              <h2 className="text-lg font-semibold">
                                {searchQuery
                                  ? `Search results for "${searchQuery}"`
                                  : categories.find((c) => c.id === selectedCategory)?.name}
                              </h2>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="space-y-4">
                            {filteredArticles.map((article) => (
                              <Card
                                key={article.id}
                                className="cursor-pointer hover:shadow-md transition-all"
                                onClick={() => setSelectedArticle(article)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="text-xs">
                                          {article.category.replace("-", " ")}
                                        </Badge>
                                        {article.featured && (
                                          <Badge className="bg-amber-100 text-amber-700 text-xs">
                                            Featured
                                          </Badge>
                                        )}
                                      </div>
                                      <h3 className="font-semibold">{article.title}</h3>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {article.description}
                                      </p>
                                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {article.readTime} min read
                                        </span>
                                      </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}

                            {filteredArticles.length === 0 && (
                              <div className="text-center py-12 text-muted-foreground">
                                <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No articles found</p>
                                <p className="text-sm">Try adjusting your search or browse topics</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* FAQs Tab */}
                <TabsContent value="faqs" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Frequently Asked Questions</CardTitle>
                      <CardDescription>
                        Quick answers to common questions about Spencer McGaw Hub
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {filteredFAQs.map((faq, index) => (
                          <AccordionItem key={index} value={`faq-${index}`}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-3">
                                <HelpCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                {faq.question}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="pl-7">
                                <p className="text-muted-foreground">{faq.answer}</p>
                                <Badge variant="outline" className="mt-3 text-xs">
                                  {faq.category}
                                </Badge>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>

                      {filteredFAQs.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No FAQs found matching your search</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Contact Support Tab */}
                <TabsContent value="contact" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                            <Mail className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>Email Support</CardTitle>
                            <CardDescription>Get help via email</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Send us an email and we'll respond within 24 hours during business days.
                        </p>
                        <Button className="w-full" asChild>
                          <a href="mailto:support@spencermcgaw.com">
                            <Mail className="h-4 w-4 mr-2" />
                            support@spencermcgaw.com
                          </a>
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-green-100 text-green-600">
                            <Phone className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle>Phone Support</CardTitle>
                            <CardDescription>Talk to our team</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Available Monday-Friday, 9am-5pm CST for urgent issues.
                        </p>
                        <Button variant="outline" className="w-full" asChild>
                          <a href="tel:+15551234567">
                            <Phone className="h-4 w-4 mr-2" />
                            (555) 123-4567
                          </a>
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                      <CardHeader>
                        <CardTitle>Submit a Support Request</CardTitle>
                        <CardDescription>
                          Describe your issue and we'll get back to you as soon as possible
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Subject</label>
                              <Input placeholder="Brief description of your issue" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Category</label>
                              <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option>General Question</option>
                                <option>Technical Issue</option>
                                <option>Account Access</option>
                                <option>Feature Request</option>
                                <option>Integration Help</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, and what you expected to happen."
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button>
                              Submit Request
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Sidebar - Quick Links */}
          <div className="w-72 flex-shrink-0 border-l bg-muted/30 p-4 hidden lg:block overflow-auto">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                size="sm"
                onClick={triggerOnboarding}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Restart Onboarding Tour
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                size="sm"
                onClick={() => {
                  const article = articles.find(a => a.id === "quick-start-guide");
                  if (article) setSelectedArticle(article);
                  setActiveTab("knowledge-base");
                }}
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Start Guide
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                size="sm"
                onClick={() => {
                  const article = articles.find(a => a.id === "task-management");
                  if (article) setSelectedArticle(article);
                  setActiveTab("knowledge-base");
                }}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Task Management
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                size="sm"
                onClick={() => {
                  const article = articles.find(a => a.id === "user-roles");
                  if (article) setSelectedArticle(article);
                  setActiveTab("knowledge-base");
                }}
              >
                <UserCog className="h-4 w-4 mr-2" />
                User Roles Guide
              </Button>
            </div>

            <Separator className="my-4" />

            <h3 className="font-semibold mb-4">Popular Topics</h3>
            <div className="space-y-1">
              {[
                { label: "Getting Started", id: "getting-started" },
                { label: "Tasks & Workflow", id: "tasks" },
                { label: "Email Integration", id: "email" },
                { label: "User Management", id: "admin" },
              ].map(topic => (
                <Button
                  key={topic.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => {
                    setSelectedCategory(topic.id);
                    setActiveTab("knowledge-base");
                    setSelectedArticle(null);
                  }}
                >
                  <ChevronRight className="h-3 w-3 mr-2" />
                  {topic.label}
                </Button>
              ))}
            </div>

            <Separator className="my-4" />

            <h3 className="font-semibold mb-4">System Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Platform</span>
                <Badge className="bg-green-500">Operational</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Email Sync</span>
                <Badge className="bg-green-500">Operational</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>AI Services</span>
                <Badge className="bg-green-500">Operational</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Phone/VAPI</span>
                <Badge className="bg-green-500">Operational</Badge>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
