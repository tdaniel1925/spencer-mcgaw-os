"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  Video,
  Phone,
  Mail,
  Calendar,
  Users,
  Bot,
  Settings,
  Shield,
  Database,
  Zap,
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle,
  PlayCircle,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Star,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    articleCount: 8,
  },
  {
    id: "clients",
    name: "Client Management",
    icon: <Users className="h-5 w-5" />,
    description: "Managing clients and contacts",
    articleCount: 12,
  },
  {
    id: "calendar",
    name: "Calendar & Scheduling",
    icon: <Calendar className="h-5 w-5" />,
    description: "Calendar features and AI scheduling",
    articleCount: 10,
  },
  {
    id: "email",
    name: "Email & AI Tasks",
    icon: <Mail className="h-5 w-5" />,
    description: "Email integration and AI processing",
    articleCount: 15,
  },
  {
    id: "calls",
    name: "Phone & AI Agent",
    icon: <Phone className="h-5 w-5" />,
    description: "Phone features and AI assistant",
    articleCount: 9,
  },
  {
    id: "ai-features",
    name: "AI Features",
    icon: <Bot className="h-5 w-5" />,
    description: "AI-powered automation and insights",
    articleCount: 11,
  },
  {
    id: "integrations",
    name: "Integrations",
    icon: <Zap className="h-5 w-5" />,
    description: "Third-party integrations and webhooks",
    articleCount: 14,
  },
  {
    id: "admin",
    name: "Administration",
    icon: <Settings className="h-5 w-5" />,
    description: "System settings and user management",
    articleCount: 7,
  },
  {
    id: "security",
    name: "Security & Privacy",
    icon: <Shield className="h-5 w-5" />,
    description: "Security features and compliance",
    articleCount: 6,
  },
];

// Knowledge Base Articles
const articles: Article[] = [
  {
    id: "quick-start-guide",
    title: "Quick Start Guide",
    description: "Get up and running with Spencer McGaw Hub in minutes",
    category: "getting-started",
    tags: ["basics", "setup", "introduction"],
    readTime: 5,
    lastUpdated: "2024-03-15",
    featured: true,
    content: [
      { type: "paragraph", content: "Welcome to Spencer McGaw Hub! This guide will help you get started with the essential features of the platform." },
      { type: "heading", content: "Step 1: Complete Your Profile" },
      { type: "paragraph", content: "Navigate to Settings > Profile to add your information, upload a profile photo, and set your preferences." },
      { type: "heading", content: "Step 2: Connect Your Email" },
      { type: "paragraph", content: "Go to Admin > System Settings > Integrations to connect your Microsoft 365 or Google Workspace account for email sync." },
      { type: "heading", content: "Step 3: Set Up Phone Webhooks" },
      { type: "paragraph", content: "Configure your phone system webhooks in System Settings to enable call tracking and AI phone features." },
      { type: "tip", content: "Pro tip: Enable AI email processing to automatically categorize and prioritize incoming emails." },
    ],
  },
  {
    id: "understanding-dashboard",
    title: "Understanding Your Dashboard",
    description: "Learn how to navigate and customize your dashboard",
    category: "getting-started",
    tags: ["dashboard", "navigation", "widgets"],
    readTime: 4,
    lastUpdated: "2024-03-14",
    content: [
      { type: "paragraph", content: "The dashboard is your command center for all activities. It provides a quick overview of your tasks, clients, and key metrics." },
      { type: "list", content: ["Overview cards show key statistics", "Quick actions for common tasks", "Recent activity feed", "Upcoming appointments"] },
    ],
  },
  {
    id: "adding-clients",
    title: "Adding and Managing Clients",
    description: "How to add new clients and manage existing ones",
    category: "clients",
    tags: ["clients", "contacts", "management"],
    readTime: 6,
    lastUpdated: "2024-03-13",
    featured: true,
    content: [
      { type: "paragraph", content: "Managing clients effectively is at the heart of Spencer McGaw Hub. Here's how to add and manage your clients." },
      { type: "steps", content: ["Go to Clients page", "Click 'Add Client' button", "Fill in client information", "Select service types", "Assign to a team member", "Save the client"] },
    ],
  },
  {
    id: "ai-email-processing",
    title: "AI Email Processing",
    description: "How the AI analyzes and categorizes your emails",
    category: "email",
    tags: ["ai", "email", "automation"],
    readTime: 8,
    lastUpdated: "2024-03-12",
    featured: true,
    content: [
      { type: "paragraph", content: "Our AI email processing automatically analyzes incoming emails to extract key information and prioritize your inbox." },
      { type: "heading", content: "How It Works" },
      { type: "list", content: ["Emails are automatically scanned upon receipt", "AI identifies the category (document request, question, payment, etc.)", "Priority level is assigned based on content analysis", "Key points and action items are extracted", "Emails are matched to existing clients when possible"] },
      { type: "tip", content: "The AI learns from your actions over time to improve accuracy." },
    ],
  },
  {
    id: "calendar-sync",
    title: "Calendar Sync & Integration",
    description: "Connecting Google and Microsoft calendars",
    category: "calendar",
    tags: ["calendar", "google", "microsoft", "sync"],
    readTime: 5,
    lastUpdated: "2024-03-11",
    content: [
      { type: "paragraph", content: "Spencer McGaw Hub can sync with your existing calendars to provide a unified view of all your appointments." },
      { type: "heading", content: "Connecting Google Calendar" },
      { type: "steps", content: ["Navigate to Calendar page", "Click 'Connect Calendar' in the sidebar", "Select Google Calendar", "Authorize access in the popup", "Your events will start syncing immediately"] },
      { type: "warning", content: "Make sure pop-ups are enabled for the authorization window to appear." },
    ],
  },
  {
    id: "ai-scheduling",
    title: "AI-Powered Scheduling",
    description: "Let AI find the perfect meeting time",
    category: "calendar",
    tags: ["ai", "scheduling", "automation"],
    readTime: 6,
    lastUpdated: "2024-03-10",
    content: [
      { type: "paragraph", content: "The AI scheduling feature analyzes your calendar and preferences to suggest optimal meeting times." },
      { type: "heading", content: "Using AI Schedule" },
      { type: "steps", content: ["Click 'AI Schedule' button on the calendar page", "Enter meeting details (title, duration, attendees)", "Set your preferences (time of day, specific days)", "AI will analyze available slots", "Review and select from suggested times"] },
    ],
  },
  {
    id: "phone-webhooks",
    title: "Setting Up Phone Webhooks",
    description: "Configure webhooks for phone call integration",
    category: "integrations",
    tags: ["webhooks", "phone", "twilio", "vapi"],
    readTime: 7,
    lastUpdated: "2024-03-15",
    featured: true,
    content: [
      { type: "paragraph", content: "Phone webhooks allow Spencer McGaw Hub to receive real-time notifications about phone calls, enabling features like call logging, AI transcription, and more." },
      { type: "heading", content: "Available Webhooks" },
      { type: "list", content: ["Inbound Call Webhook - Triggered when a call is incoming", "Call Status Webhook - Updates on call status changes", "Recording Webhook - Receives call recordings and transcriptions", "Voicemail Webhook - Handles voicemail notifications"] },
      { type: "heading", content: "Configuration Steps" },
      { type: "steps", content: ["Go to Admin > System Settings > Integrations", "Scroll to 'Phone Call Webhooks' section", "Copy the webhook URLs", "Configure your Twilio or VAPI settings with these URLs", "Test the connection using the 'Send Test Event' button"] },
      { type: "tip", content: "Keep your webhook secret safe - it's used to verify incoming requests." },
    ],
  },
  {
    id: "ai-phone-agent",
    title: "AI Phone Agent Configuration",
    description: "Set up and customize your AI phone assistant",
    category: "calls",
    tags: ["ai", "phone", "vapi", "assistant"],
    readTime: 10,
    lastUpdated: "2024-03-14",
    content: [
      { type: "paragraph", content: "The AI Phone Agent powered by VAPI can handle incoming calls, answer common questions, and schedule appointments automatically." },
      { type: "heading", content: "Agent Settings" },
      { type: "list", content: ["Voice Selection - Choose from professional or friendly voices", "Operating Hours - Set when the AI should answer calls", "Appointment Scheduling - Enable direct calendar booking", "Transfer Options - Configure when to transfer to a human"] },
      { type: "warning", content: "AI Phone Agent usage is billed at $0.05 per minute. Monitor usage in your dashboard." },
    ],
  },
  {
    id: "user-roles",
    title: "User Roles and Permissions",
    description: "Understanding role-based access control",
    category: "admin",
    tags: ["users", "roles", "permissions", "admin"],
    readTime: 6,
    lastUpdated: "2024-03-13",
    content: [
      { type: "paragraph", content: "Spencer McGaw Hub uses role-based access control to manage what users can see and do in the system." },
      { type: "heading", content: "Available Roles" },
      { type: "list", content: ["Admin - Full access to all features and settings", "Manager - Can manage clients and team members", "Staff - Standard access to client and task features", "Read-Only - View-only access for auditing"] },
    ],
  },
  {
    id: "data-security",
    title: "Data Security & Encryption",
    description: "How we protect your sensitive data",
    category: "security",
    tags: ["security", "encryption", "compliance"],
    readTime: 5,
    lastUpdated: "2024-03-12",
    content: [
      { type: "paragraph", content: "We take data security seriously. All data is encrypted at rest and in transit using industry-standard encryption protocols." },
      { type: "heading", content: "Security Features" },
      { type: "list", content: ["AES-256 encryption for data at rest", "TLS 1.3 for data in transit", "Two-factor authentication support", "Session timeout controls", "Audit logging for all actions"] },
    ],
  },
];

// FAQs
const faqs: FAQ[] = [
  {
    question: "How do I connect my email account?",
    answer: "Go to Admin > System Settings > Integrations, then click 'Connect Account' under Email Integration. You can connect Microsoft 365 or Google Workspace accounts.",
    category: "email",
  },
  {
    question: "What happens when I receive a new email?",
    answer: "Incoming emails are automatically processed by AI which categorizes them, assigns priority, extracts key points, and matches them to existing clients when possible.",
    category: "email",
  },
  {
    question: "How does the AI phone agent work?",
    answer: "The AI phone agent (powered by VAPI) can answer incoming calls, respond to common questions using your knowledge base, and even schedule appointments directly on your calendar.",
    category: "calls",
  },
  {
    question: "Can I use my own Twilio account?",
    answer: "Yes! You can configure your own Twilio API keys in Admin > System Settings > API Keys. This allows you to use your own phone numbers and have more control over SMS/voice features.",
    category: "integrations",
  },
  {
    question: "How do I set up phone call webhooks?",
    answer: "Navigate to Admin > System Settings > Integrations and scroll to 'Phone Call Webhooks'. Copy the provided URLs and configure them in your Twilio or VAPI dashboard.",
    category: "integrations",
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We also support two-factor authentication and maintain detailed audit logs.",
    category: "security",
  },
  {
    question: "How do I add a new team member?",
    answer: "Go to Admin > User Management and click 'Add User'. Fill in their details, select a role, and they'll receive an invitation email to set up their account.",
    category: "admin",
  },
  {
    question: "Can I sync multiple calendars?",
    answer: "Yes! You can connect both Google Calendar and Microsoft 365 calendars. All events from connected calendars appear in a unified view.",
    category: "calendar",
  },
  {
    question: "What is AI scheduling?",
    answer: "AI scheduling analyzes your calendar, preferences, and meeting requirements to suggest optimal time slots. It considers factors like buffer time, preferred meeting times, and existing commitments.",
    category: "calendar",
  },
  {
    question: "How do I export my data?",
    answer: "Go to Admin > System Settings > Backup & Data. You can export clients, documents, emails, or all data at once in standard formats.",
    category: "admin",
  },
];

// Video tutorials
const videoTutorials = [
  {
    id: "intro-tour",
    title: "Platform Overview Tour",
    duration: "5:30",
    thumbnail: "/tutorials/overview.png",
    category: "getting-started",
  },
  {
    id: "email-setup",
    title: "Email Integration Setup",
    duration: "4:15",
    thumbnail: "/tutorials/email.png",
    category: "email",
  },
  {
    id: "ai-features",
    title: "Using AI Features",
    duration: "8:45",
    thumbnail: "/tutorials/ai.png",
    category: "ai-features",
  },
  {
    id: "calendar-sync",
    title: "Calendar Sync Tutorial",
    duration: "3:20",
    thumbnail: "/tutorials/calendar.png",
    category: "calendar",
  },
  {
    id: "phone-setup",
    title: "Phone & Webhooks Setup",
    duration: "6:10",
    thumbnail: "/tutorials/phone.png",
    category: "calls",
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [activeTab, setActiveTab] = useState("knowledge-base");

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
                <ul key={idx} className="list-disc list-inside space-y-1 text-muted-foreground">
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
      <Header title="Help & Knowledge Base" />
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Hero Section */}
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-8">
                <h1 className="text-3xl font-bold mb-2">How can we help you?</h1>
                <p className="text-muted-foreground mb-6">
                  Search our knowledge base or browse categories below
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
                  <TabsTrigger value="videos" className="gap-2">
                    <Video className="h-4 w-4" />
                    Video Tutorials
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
                          <div className="grid grid-cols-2 gap-4">
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
                                    <span>Updated {article.lastUpdated}</span>
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
                          <h2 className="text-lg font-semibold mb-4">Browse by Category</h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {categories.map((category) => (
                              <Card
                                key={category.id}
                                className="cursor-pointer hover:shadow-md transition-all"
                                onClick={() => setSelectedCategory(category.id)}
                              >
                                <CardContent className="p-6">
                                  <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                      {category.icon}
                                    </div>
                                    <div className="flex-1">
                                      <h3 className="font-semibold">{category.name}</h3>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {category.description}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-2">
                                        {category.articleCount} articles
                                      </p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
                                  All Categories
                                </Button>
                              )}
                              <h2 className="text-lg font-semibold">
                                {searchQuery
                                  ? `Search results for "${searchQuery}"`
                                  : categories.find((c) => c.id === selectedCategory)?.name}
                              </h2>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {filteredArticles.length} articles
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
                                        <span>Updated {article.lastUpdated}</span>
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
                                <p className="text-sm">Try adjusting your search or browse categories</p>
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

                {/* Video Tutorials Tab */}
                <TabsContent value="videos" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videoTutorials.map((video) => (
                      <Card key={video.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-all">
                        <div className="aspect-video bg-muted relative flex items-center justify-center">
                          <PlayCircle className="h-16 w-16 text-primary/50" />
                          <Badge className="absolute bottom-2 right-2 bg-black/70">
                            {video.duration}
                          </Badge>
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold">{video.title}</h3>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {video.category.replace("-", " ")}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
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
                        <Button className="w-full">
                          <Mail className="h-4 w-4 mr-2" />
                          support@spencermcgaw.com
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
                        <Button variant="outline" className="w-full">
                          <Phone className="h-4 w-4 mr-2" />
                          (555) 123-4567
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
                                <option>Billing</option>
                                <option>Feature Request</option>
                                <option>Integration Help</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Please describe your issue in detail..."
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
          <div className="w-72 flex-shrink-0 border-l bg-muted/30 p-4 hidden lg:block">
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <div className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" size="sm">
                <BookOpen className="h-4 w-4 mr-2" />
                Quick Start Guide
              </Button>
              <Button variant="ghost" className="w-full justify-start" size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Webhook Setup
              </Button>
              <Button variant="ghost" className="w-full justify-start" size="sm">
                <Bot className="h-4 w-4 mr-2" />
                AI Features Guide
              </Button>
              <Button variant="ghost" className="w-full justify-start" size="sm">
                <Mail className="h-4 w-4 mr-2" />
                Email Integration
              </Button>
            </div>

            <Separator className="my-4" />

            <h3 className="font-semibold mb-4">Need More Help?</h3>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Live Chat</p>
                    <p className="text-xs text-muted-foreground">Available 9am-5pm CST</p>
                  </div>
                </div>
                <Button size="sm" className="w-full">
                  Start Chat
                </Button>
              </CardContent>
            </Card>

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

            <Button variant="link" size="sm" className="mt-2 p-0">
              <ExternalLink className="h-3 w-3 mr-1" />
              View Status Page
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
