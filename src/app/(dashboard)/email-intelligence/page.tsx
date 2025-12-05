"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Edit3,
  ExternalLink,
  FileText,
  Filter,
  HelpCircle,
  Inbox,
  Info,
  Loader2,
  Mail,
  MoreVertical,
  Paperclip,
  RefreshCw,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  UserPlus,
  X,
  Zap,
  AlertTriangle,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Types
interface EmailIntelligence {
  id: string;
  emailId: string;
  accountId: string;
  from: {
    name: string;
    email: string;
  };
  subject: string;
  receivedAt: Date;
  hasAttachments: boolean;

  // AI Extraction
  summary: string;
  primaryAction: string | null;
  actionItems: ActionItem[];
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  priorityScore: number;
  sentiment: "positive" | "neutral" | "negative";
  urgency: "low" | "medium" | "high" | "urgent";
  requiresResponse: boolean;
  responseDeadline: Date | null;

  // Extracted entities
  extractedDates: { value: string; context: string }[];
  extractedAmounts: { value: number; context: string }[];
  extractedDocumentTypes: string[];
  extractedNames: { name: string; role?: string }[];

  // Client matching
  matchedClientId: string | null;
  matchedClientName: string | null;
  clientMatchConfidence: number;

  // Suggested assignment
  suggestedAssigneeId: string | null;
  suggestedAssigneeName: string | null;
  assignmentReason: string | null;

  // Draft response
  draftResponse: string | null;

  // Status
  status: "pending" | "approved" | "dismissed" | "delegated";
  processedAt: Date;

  // Original email for viewing
  body?: string;
  bodyType?: "html" | "text";
}

interface ActionItem {
  id: string;
  title: string;
  description?: string;
  type: "response" | "document" | "calendar" | "task" | "call" | "review";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: Date;
  confidence: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

// Category config
const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  document_request: { label: "Document Request", icon: <FileText className="h-3.5 w-3.5" />, color: "bg-blue-100 text-blue-700" },
  question: { label: "Question", icon: <HelpCircle className="h-3.5 w-3.5" />, color: "bg-purple-100 text-purple-700" },
  payment: { label: "Payment", icon: <DollarSign className="h-3.5 w-3.5" />, color: "bg-green-100 text-green-700" },
  appointment: { label: "Appointment", icon: <Calendar className="h-3.5 w-3.5" />, color: "bg-amber-100 text-amber-700" },
  tax_filing: { label: "Tax Filing", icon: <FileText className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-700" },
  compliance: { label: "Compliance", icon: <Shield className="h-3.5 w-3.5" />, color: "bg-orange-100 text-orange-700" },
  follow_up: { label: "Follow Up", icon: <Clock className="h-3.5 w-3.5" />, color: "bg-cyan-100 text-cyan-700" },
  information: { label: "Information", icon: <Info className="h-3.5 w-3.5" />, color: "bg-slate-100 text-slate-700" },
  urgent: { label: "Urgent", icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-700" },
  internal: { label: "Internal", icon: <User className="h-3.5 w-3.5" />, color: "bg-gray-100 text-gray-700" },
  other: { label: "Other", icon: <Mail className="h-3.5 w-3.5" />, color: "bg-gray-100 text-gray-700" },
};

const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  urgent: { label: "Urgent", color: "text-red-700", bgColor: "bg-red-100 border-red-200" },
  high: { label: "High", color: "text-orange-700", bgColor: "bg-orange-100 border-orange-200" },
  medium: { label: "Medium", color: "text-amber-700", bgColor: "bg-amber-100 border-amber-200" },
  low: { label: "Low", color: "text-slate-600", bgColor: "bg-slate-100 border-slate-200" },
};

// Email Intelligence Card Component
function EmailIntelligenceCard({
  intelligence,
  onApprove,
  onDismiss,
  onDelegate,
  onEdit,
  onView,
}: {
  intelligence: EmailIntelligence;
  onApprove: () => void;
  onDismiss: () => void;
  onDelegate: () => void;
  onEdit: () => void;
  onView: () => void;
}) {
  const category = categoryConfig[intelligence.category] || categoryConfig.other;
  const priority = priorityConfig[intelligence.priority] || priorityConfig.medium;

  // Safe access to from fields
  const fromName = intelligence.from?.name || "";
  const fromEmail = intelligence.from?.email || "unknown@email.com";
  const displayName = intelligence.matchedClientName || fromName || fromEmail;

  // Safe date formatting
  const receivedDate = intelligence.receivedAt instanceof Date
    ? intelligence.receivedAt
    : new Date(intelligence.receivedAt);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      {/* Header: From & Time */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {(fromName || fromEmail)
              .split(" ")
              .map((n) => n?.[0] || "")
              .join("")
              .slice(0, 2)
              .toUpperCase() || "??"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {displayName}
            </span>
            {intelligence.matchedClientId && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5">
                Client
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{fromEmail}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            {formatDistanceToNow(receivedDate, { addSuffix: true })}
          </span>
          {intelligence.hasAttachments && (
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Subject */}
      <h3 className="font-medium text-sm mb-2 line-clamp-1">{intelligence.subject}</h3>

      {/* AI Summary */}
      <div className="bg-muted/40 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <Bot className="h-3.5 w-3.5" />
          <span>AI Summary</span>
        </div>
        <p className="text-sm text-foreground">{intelligence.summary}</p>
      </div>

      {/* Primary Action / Extracted Task */}
      {(intelligence.primaryAction || intelligence.actionItems.length > 0) && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>Extracted Action{intelligence.actionItems.length > 1 ? "s" : ""}</span>
          </div>
          <p className="text-sm font-medium">
            {intelligence.primaryAction || intelligence.actionItems[0]?.title}
          </p>
          {intelligence.actionItems.length > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              +{intelligence.actionItems.length - 1} more action{intelligence.actionItems.length > 2 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Badges: Priority, Category, Deadline */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Badge variant="outline" className={cn("text-[10px] px-1.5", priority.bgColor)}>
          {priority.label}
        </Badge>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 gap-1", category.color)}>
          {category.icon}
          {category.label}
        </Badge>
        {intelligence.responseDeadline && (
          <Badge variant="outline" className="text-[10px] px-1.5 gap-1 bg-orange-50 text-orange-700 border-orange-200">
            <Clock className="h-3 w-3" />
            Due: {format(intelligence.responseDeadline, "MMM d")}
          </Badge>
        )}
        {intelligence.extractedAmounts.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 gap-1 bg-green-50 text-green-700 border-green-200">
            <DollarSign className="h-3 w-3" />
            ${intelligence.extractedAmounts[0].value.toLocaleString()}
          </Badge>
        )}
      </div>

      {/* Suggested Assignee */}
      {intelligence.suggestedAssigneeName && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <UserPlus className="h-3.5 w-3.5" />
          <span>Suggested: <span className="font-medium text-foreground">{intelligence.suggestedAssigneeName}</span></span>
          {intelligence.assignmentReason && (
            <span className="text-muted-foreground/70">({intelligence.assignmentReason})</span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-3 border-t">
        <Button
          size="sm"
          className="flex-1 h-8 bg-primary hover:bg-primary/90"
          onClick={onApprove}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Create Task
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onEdit}
        >
          <Edit3 className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Dismiss
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Mail className="h-4 w-4 mr-2" />
              View Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelegate}>
              <UserPlus className="h-4 w-4 mr-2" />
              Delegate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

// Edit Modal Component
function EditIntelligenceModal({
  intelligence,
  open,
  onClose,
  onSave,
}: {
  intelligence: EmailIntelligence | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<EmailIntelligence>) => void;
}) {
  const [editedPrimaryAction, setEditedPrimaryAction] = useState("");
  const [editedPriority, setEditedPriority] = useState<string>("medium");
  const [editedCategory, setEditedCategory] = useState<string>("other");

  useEffect(() => {
    if (intelligence) {
      setEditedPrimaryAction(intelligence.primaryAction || intelligence.actionItems[0]?.title || "");
      setEditedPriority(intelligence.priority);
      setEditedCategory(intelligence.category);
    }
  }, [intelligence]);

  if (!intelligence) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Edit Extraction
          </DialogTitle>
          <DialogDescription>
            Modify the AI-extracted information before creating a task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary (read-only) */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">AI Summary</label>
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              {intelligence.summary}
            </p>
          </div>

          {/* Primary Action */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Primary Action</label>
            <Input
              value={editedPrimaryAction}
              onChange={(e) => setEditedPrimaryAction(e.target.value)}
              placeholder="What needs to be done?"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Priority</label>
            <Select value={editedPriority} onValueChange={setEditedPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Category</label>
            <Select value={editedCategory} onValueChange={setEditedCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {config.icon}
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave({
                primaryAction: editedPrimaryAction,
                priority: editedPriority as EmailIntelligence["priority"],
                category: editedCategory,
              });
            }}
          >
            Save & Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delegate Modal Component
function DelegateModal({
  intelligence,
  open,
  onClose,
  onDelegate,
  teamMembers,
}: {
  intelligence: EmailIntelligence | null;
  open: boolean;
  onClose: () => void;
  onDelegate: (memberId: string) => void;
  teamMembers: TeamMember[];
}) {
  const [selectedMember, setSelectedMember] = useState<string>("");

  if (!intelligence) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Delegate Task
          </DialogTitle>
          <DialogDescription>
            Assign this task to a team member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium">{intelligence.primaryAction || intelligence.actionItems[0]?.title}</p>
            <p className="text-xs text-muted-foreground mt-1">From: {intelligence.from.name}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Assign to</label>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                    selectedMember === member.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedMember(member.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {member.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {selectedMember === member.id && (
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onDelegate(selectedMember)} disabled={!selectedMember}>
            Delegate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// View Email Modal
function ViewEmailModal({
  intelligence,
  open,
  onClose,
}: {
  intelligence: EmailIntelligence | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!intelligence) return null;

  // Safe access
  const fromName = intelligence.from?.name || "";
  const fromEmail = intelligence.from?.email || "unknown@email.com";
  const displayName = fromName || fromEmail;
  const receivedDate = intelligence.receivedAt instanceof Date
    ? intelligence.receivedAt
    : new Date(intelligence.receivedAt);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{intelligence.subject}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* From/Date */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {displayName.slice(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{displayName}</p>
              <p className="text-sm text-muted-foreground">{fromEmail}</p>
            </div>
            <p className="text-sm text-muted-foreground ml-auto" suppressHydrationWarning>
              {format(receivedDate, "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>

          {/* AI Analysis */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI Analysis</span>
              <ChevronDown className="h-4 w-4 ml-auto" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-3 p-3 border rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm">{intelligence.summary}</p>
                </div>
                {intelligence.actionItems.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Action Items</p>
                    <ul className="space-y-1">
                      {intelligence.actionItems.map((item) => (
                        <li key={item.id} className="text-sm flex items-start gap-2">
                          <ListTodo className="h-3.5 w-3.5 mt-0.5 text-primary" />
                          {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Email Body */}
          <div className="border rounded-lg overflow-hidden">
            {intelligence.bodyType === "html" && intelligence.body ? (
              <iframe
                srcDoc={intelligence.body}
                className="w-full min-h-[300px] border-0 bg-white"
                sandbox="allow-same-origin"
                title="Email content"
              />
            ) : (
              <div className="p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {intelligence.body || "No email body available"}
                </pre>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Loading skeleton
function IntelligenceCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-20 w-full mb-3 rounded-lg" />
      <Skeleton className="h-16 w-full mb-3 rounded-lg" />
      <div className="flex gap-2 mb-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </Card>
  );
}

// Main Page Component
export default function EmailIntelligencePage() {
  const [intelligences, setIntelligences] = useState<EmailIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "dismissed">("pending");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Modal states
  const [editingIntelligence, setEditingIntelligence] = useState<EmailIntelligence | null>(null);
  const [delegatingIntelligence, setDelegatingIntelligence] = useState<EmailIntelligence | null>(null);
  const [viewingIntelligence, setViewingIntelligence] = useState<EmailIntelligence | null>(null);

  // Mock team members
  const teamMembers: TeamMember[] = [
    { id: "1", name: "Sarah Johnson", email: "sarah@spencermcgaw.com" },
    { id: "2", name: "Mike Chen", email: "mike@spencermcgaw.com" },
    { id: "3", name: "Emily Davis", email: "emily@spencermcgaw.com" },
  ];

  // Load email intelligences
  const loadIntelligences = useCallback(async () => {
    try {
      const res = await fetch(`/api/email-intelligence?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setIntelligences(data.intelligences || []);
      } else {
        // Use mock data for demo
        setIntelligences(getMockData());
      }
    } catch (error) {
      console.error("Failed to load intelligences:", error);
      // Use mock data for demo
      setIntelligences(getMockData());
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadIntelligences();
  }, [loadIntelligences]);

  // Sync emails and process with AI
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/email-intelligence/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Processed ${data.processed} new emails`);
        loadIntelligences();
      } else {
        toast.error("Failed to sync emails");
      }
    } catch (error) {
      toast.error("Failed to sync emails");
    } finally {
      setSyncing(false);
    }
  };

  // Approve and create task
  const handleApprove = async (intelligence: EmailIntelligence) => {
    try {
      const res = await fetch(`/api/email-intelligence/${intelligence.id}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Task created successfully");
        setIntelligences((prev) =>
          prev.map((i) => (i.id === intelligence.id ? { ...i, status: "approved" } : i))
        );
      } else {
        toast.error("Failed to create task");
      }
    } catch (error) {
      // For demo, just update local state
      toast.success("Task created successfully");
      setIntelligences((prev) =>
        prev.map((i) => (i.id === intelligence.id ? { ...i, status: "approved" } : i))
      );
    }
  };

  // Dismiss
  const handleDismiss = async (intelligence: EmailIntelligence) => {
    try {
      await fetch(`/api/email-intelligence/${intelligence.id}/dismiss`, {
        method: "POST",
      });
    } catch (error) {
      // Continue anyway for demo
    }
    toast.success("Dismissed");
    setIntelligences((prev) =>
      prev.map((i) => (i.id === intelligence.id ? { ...i, status: "dismissed" } : i))
    );
  };

  // Delegate
  const handleDelegate = async (intelligence: EmailIntelligence, memberId: string) => {
    const member = teamMembers.find((m) => m.id === memberId);
    toast.success(`Delegated to ${member?.name}`);
    setIntelligences((prev) =>
      prev.map((i) =>
        i.id === intelligence.id
          ? { ...i, status: "delegated" as const, suggestedAssigneeName: member?.name || null, suggestedAssigneeId: memberId }
          : i
      )
    );
    setDelegatingIntelligence(null);
  };

  // Edit and save
  const handleEditSave = async (intelligence: EmailIntelligence, updates: Partial<EmailIntelligence>) => {
    setIntelligences((prev) =>
      prev.map((i) => (i.id === intelligence.id ? { ...i, ...updates } : i))
    );
    setEditingIntelligence(null);
    // Then approve
    handleApprove({ ...intelligence, ...updates });
  };

  // Filter intelligences
  const filteredIntelligences = intelligences.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && i.priority !== priorityFilter) return false;
    return true;
  });

  // Stats
  const pendingCount = intelligences.filter((i) => i.status === "pending").length;
  const approvedCount = intelligences.filter((i) => i.status === "approved").length;
  const totalActionItems = intelligences.reduce((sum, i) => sum + i.actionItems.length, 0);

  return (
    <TooltipProvider delayDuration={0}>
      <Header title="AI Email Intelligence" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>

          <div className="h-6 w-px bg-border mx-2" />

          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-medium">AI Email Intelligence</span>
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </div>

          <div className="flex-1" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{pendingCount} pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">{approvedCount} approved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ListTodo className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{totalActionItems} actions</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing ? "Syncing..." : "Sync & Process"}
          </Button>
        </div>

        {/* Filters */}
        <div className="h-12 border-b bg-card/50 flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>

          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    {config.icon}
                    {config.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <span className="text-xs text-muted-foreground">
            Showing {filteredIntelligences.length} of {intelligences.length} emails
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-muted/30">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <IntelligenceCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredIntelligences.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No emails to process</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {filter === "pending"
                  ? "All caught up! No pending emails need your attention."
                  : "No emails match your current filters."}
              </p>
              <Button onClick={handleSync} disabled={syncing}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                Sync New Emails
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIntelligences.map((intelligence) => (
                <EmailIntelligenceCard
                  key={intelligence.id}
                  intelligence={intelligence}
                  onApprove={() => handleApprove(intelligence)}
                  onDismiss={() => handleDismiss(intelligence)}
                  onDelegate={() => setDelegatingIntelligence(intelligence)}
                  onEdit={() => setEditingIntelligence(intelligence)}
                  onView={() => setViewingIntelligence(intelligence)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <EditIntelligenceModal
        intelligence={editingIntelligence}
        open={!!editingIntelligence}
        onClose={() => setEditingIntelligence(null)}
        onSave={(updates) => editingIntelligence && handleEditSave(editingIntelligence, updates)}
      />

      <DelegateModal
        intelligence={delegatingIntelligence}
        open={!!delegatingIntelligence}
        onClose={() => setDelegatingIntelligence(null)}
        onDelegate={(memberId) => delegatingIntelligence && handleDelegate(delegatingIntelligence, memberId)}
        teamMembers={teamMembers}
      />

      <ViewEmailModal
        intelligence={viewingIntelligence}
        open={!!viewingIntelligence}
        onClose={() => setViewingIntelligence(null)}
      />
    </TooltipProvider>
  );
}

// Mock data for demo
function getMockData(): EmailIntelligence[] {
  return [
    {
      id: "1",
      emailId: "email-1",
      accountId: "acc-1",
      from: { name: "John Smith", email: "john.smith@abccorp.com" },
      subject: "Need Q3 Estimated Tax Payment Vouchers",
      receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      hasAttachments: false,
      summary: "Client requesting Q3 estimated tax payment vouchers. Mentions deadline of December 15th. Appears to be an existing client based on email domain match.",
      primaryAction: "Generate Q3 estimated tax vouchers for ABC Corp",
      actionItems: [
        { id: "a1", title: "Generate Q3 estimated tax vouchers", type: "task", priority: "high", confidence: 0.95 },
        { id: "a2", title: "Send vouchers to client by Dec 15", type: "response", priority: "high", dueDate: new Date("2025-12-15"), confidence: 0.9 },
      ],
      category: "tax_filing",
      priority: "high",
      priorityScore: 78,
      sentiment: "neutral",
      urgency: "high",
      requiresResponse: true,
      responseDeadline: new Date("2025-12-15"),
      extractedDates: [{ value: "2025-12-15", context: "Payment deadline" }],
      extractedAmounts: [],
      extractedDocumentTypes: ["Estimated tax voucher"],
      extractedNames: [{ name: "John Smith", role: "client" }],
      matchedClientId: "client-1",
      matchedClientName: "ABC Corporation",
      clientMatchConfidence: 0.92,
      suggestedAssigneeId: "1",
      suggestedAssigneeName: "Sarah Johnson",
      assignmentReason: "Handles ABC Corp account",
      draftResponse: null,
      status: "pending",
      processedAt: new Date(),
    },
    {
      id: "2",
      emailId: "email-2",
      accountId: "acc-1",
      from: { name: "Mary Williams", email: "mary@williamsfamily.com" },
      subject: "W-2 and 1099 Forms for 2024 Tax Return",
      receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      hasAttachments: true,
      summary: "Client sending W-2 and 1099 forms for their 2024 tax return. Attached 3 documents. Ready for tax preparation.",
      primaryAction: "Review and save attached W-2 and 1099 documents",
      actionItems: [
        { id: "a3", title: "Review attached W-2 forms", type: "document", priority: "medium", confidence: 0.98 },
        { id: "a4", title: "Review attached 1099 forms", type: "document", priority: "medium", confidence: 0.98 },
        { id: "a5", title: "Begin 2024 tax return preparation", type: "task", priority: "medium", confidence: 0.85 },
      ],
      category: "document_request",
      priority: "medium",
      priorityScore: 62,
      sentiment: "positive",
      urgency: "medium",
      requiresResponse: true,
      responseDeadline: null,
      extractedDates: [],
      extractedAmounts: [],
      extractedDocumentTypes: ["W-2", "1099"],
      extractedNames: [{ name: "Mary Williams", role: "client" }],
      matchedClientId: "client-2",
      matchedClientName: "Williams Family",
      clientMatchConfidence: 0.88,
      suggestedAssigneeId: null,
      suggestedAssigneeName: null,
      assignmentReason: null,
      draftResponse: null,
      status: "pending",
      processedAt: new Date(),
    },
    {
      id: "3",
      emailId: "email-3",
      accountId: "acc-1",
      from: { name: "Robert Chen", email: "robert@chenenterprises.com" },
      subject: "URGENT: IRS Notice - Need Help ASAP",
      receivedAt: new Date(Date.now() - 30 * 60 * 1000),
      hasAttachments: true,
      summary: "URGENT: Client received IRS Notice CP2000 regarding unreported income. Needs immediate assistance. Attached is the notice. Response deadline in 30 days.",
      primaryAction: "Review IRS Notice CP2000 and schedule urgent consultation",
      actionItems: [
        { id: "a6", title: "Review attached IRS Notice CP2000", type: "review", priority: "urgent", confidence: 0.99 },
        { id: "a7", title: "Schedule urgent consultation call", type: "calendar", priority: "urgent", confidence: 0.95 },
        { id: "a8", title: "Prepare response to IRS", type: "task", priority: "urgent", dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), confidence: 0.9 },
      ],
      category: "urgent",
      priority: "urgent",
      priorityScore: 95,
      sentiment: "negative",
      urgency: "urgent",
      requiresResponse: true,
      responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      extractedDates: [{ value: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), context: "IRS response deadline" }],
      extractedAmounts: [{ value: 12500, context: "Alleged unreported income" }],
      extractedDocumentTypes: ["IRS Notice CP2000"],
      extractedNames: [{ name: "Robert Chen", role: "client" }],
      matchedClientId: "client-3",
      matchedClientName: "Chen Enterprises",
      clientMatchConfidence: 0.95,
      suggestedAssigneeId: "1",
      suggestedAssigneeName: "Sarah Johnson",
      assignmentReason: "Tax resolution specialist",
      draftResponse: null,
      status: "pending",
      processedAt: new Date(),
    },
    {
      id: "4",
      emailId: "email-4",
      accountId: "acc-1",
      from: { name: "Lisa Thompson", email: "lisa.t@gmail.com" },
      subject: "Question about deducting home office expenses",
      receivedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      hasAttachments: false,
      summary: "Potential new client inquiring about home office expense deductions. Works from home full-time and wants to know what qualifies. Looking for guidance.",
      primaryAction: "Respond with home office deduction information",
      actionItems: [
        { id: "a9", title: "Send home office deduction guide", type: "response", priority: "low", confidence: 0.85 },
        { id: "a10", title: "Schedule consultation if interested", type: "calendar", priority: "low", confidence: 0.7 },
      ],
      category: "question",
      priority: "low",
      priorityScore: 35,
      sentiment: "positive",
      urgency: "low",
      requiresResponse: true,
      responseDeadline: null,
      extractedDates: [],
      extractedAmounts: [],
      extractedDocumentTypes: [],
      extractedNames: [{ name: "Lisa Thompson", role: "prospect" }],
      matchedClientId: null,
      matchedClientName: null,
      clientMatchConfidence: 0,
      suggestedAssigneeId: null,
      suggestedAssigneeName: null,
      assignmentReason: null,
      draftResponse: "Hi Lisa,\n\nThank you for reaching out! I'd be happy to help you understand home office deductions.\n\nTo qualify for the home office deduction, you need to use a portion of your home exclusively and regularly for business. There are two methods to calculate the deduction:\n\n1. Simplified method: $5 per square foot (max 300 sq ft = $1,500)\n2. Regular method: Calculate actual expenses proportional to your office space\n\nWould you like to schedule a consultation to discuss your specific situation?\n\nBest regards",
      status: "pending",
      processedAt: new Date(),
    },
    {
      id: "5",
      emailId: "email-5",
      accountId: "acc-1",
      from: { name: "Accounts Payable", email: "ap@bigvendor.com" },
      subject: "Invoice #INV-2024-5892 - Payment Due",
      receivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      hasAttachments: true,
      summary: "Vendor invoice for office supplies totaling $847.50. Payment due in 30 days. Attached is the invoice PDF.",
      primaryAction: "Process vendor invoice for payment",
      actionItems: [
        { id: "a11", title: "Review and approve invoice #INV-2024-5892", type: "review", priority: "medium", confidence: 0.95 },
        { id: "a12", title: "Schedule payment within 30 days", type: "task", priority: "medium", dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), confidence: 0.9 },
      ],
      category: "payment",
      priority: "medium",
      priorityScore: 55,
      sentiment: "neutral",
      urgency: "medium",
      requiresResponse: false,
      responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      extractedDates: [{ value: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), context: "Payment due date" }],
      extractedAmounts: [{ value: 847.50, context: "Invoice total" }],
      extractedDocumentTypes: ["Invoice"],
      extractedNames: [],
      matchedClientId: null,
      matchedClientName: null,
      clientMatchConfidence: 0,
      suggestedAssigneeId: "2",
      suggestedAssigneeName: "Mike Chen",
      assignmentReason: "Handles accounts payable",
      draftResponse: null,
      status: "pending",
      processedAt: new Date(),
    },
    {
      id: "6",
      emailId: "email-6",
      accountId: "acc-1",
      from: { name: "David Park", email: "david@parkholdings.com" },
      subject: "Schedule meeting to discuss 2025 tax planning",
      receivedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      hasAttachments: false,
      summary: "Existing client wants to schedule a meeting to discuss tax planning strategies for 2025. Mentions potential business expansion and wants advice on structure.",
      primaryAction: "Schedule tax planning meeting with David Park",
      actionItems: [
        { id: "a13", title: "Schedule 2025 tax planning meeting", type: "calendar", priority: "medium", confidence: 0.95 },
        { id: "a14", title: "Prepare business expansion tax strategy notes", type: "task", priority: "medium", confidence: 0.8 },
      ],
      category: "appointment",
      priority: "medium",
      priorityScore: 58,
      sentiment: "positive",
      urgency: "medium",
      requiresResponse: true,
      responseDeadline: null,
      extractedDates: [],
      extractedAmounts: [],
      extractedDocumentTypes: [],
      extractedNames: [{ name: "David Park", role: "client" }],
      matchedClientId: "client-4",
      matchedClientName: "Park Holdings LLC",
      clientMatchConfidence: 0.91,
      suggestedAssigneeId: "1",
      suggestedAssigneeName: "Sarah Johnson",
      assignmentReason: "Primary contact for Park Holdings",
      draftResponse: null,
      status: "pending",
      processedAt: new Date(),
    },
  ];
}
