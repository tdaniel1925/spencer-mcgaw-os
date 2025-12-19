"use client";

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  GripVertical,
  HelpCircle,
  Inbox,
  Info,
  ListTodo,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  UserPlus,
  X,
  AlertTriangle,
  FormInput,
  Globe,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";

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
  assigneeId?: string;
  assigneeName?: string;
  userFeedback?: "approved" | "rejected";
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

// Task creation dialog state
interface TaskCreationState {
  open: boolean;
  emailId: string | null;
  actionType: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo: string;
}

// Bucket type for bottom tray
interface EmailBucket {
  id: string;
  name: string;
  color: string;
  emailIds: string[];
  isDefault?: boolean;
}

// Default buckets
const defaultBuckets: EmailBucket[] = [
  { id: "follow-up", name: "Follow Up", color: "bg-amber-500", emailIds: [], isDefault: true },
  { id: "needs-response", name: "Needs Response", color: "bg-blue-500", emailIds: [], isDefault: true },
  { id: "archive", name: "Archive", color: "bg-slate-500", emailIds: [], isDefault: true },
];

// Available bucket colors
const bucketColors = [
  { name: "gray", class: "bg-gray-500" },
  { name: "red", class: "bg-red-500" },
  { name: "orange", class: "bg-orange-500" },
  { name: "amber", class: "bg-amber-500" },
  { name: "green", class: "bg-green-500" },
  { name: "teal", class: "bg-teal-500" },
  { name: "blue", class: "bg-blue-500" },
  { name: "purple", class: "bg-purple-500" },
  { name: "pink", class: "bg-pink-500" },
];

// Category icons mapping
const categoryIcons: Record<string, React.ReactNode> = {
  document_request: <FileText className="h-4 w-4" />,
  question: <HelpCircle className="h-4 w-4" />,
  payment: <DollarSign className="h-4 w-4" />,
  appointment: <Calendar className="h-4 w-4" />,
  tax_filing: <FileText className="h-4 w-4" />,
  compliance: <Shield className="h-4 w-4" />,
  follow_up: <Clock className="h-4 w-4" />,
  information: <Info className="h-4 w-4" />,
  urgent: <AlertTriangle className="h-4 w-4" />,
  internal: <User className="h-4 w-4" />,
  web_form: <FormInput className="h-4 w-4" />,
  contact_request: <Mail className="h-4 w-4" />,
  general_inquiry: <Globe className="h-4 w-4" />,
  other: <Mail className="h-4 w-4" />,
};

// Category config for labels
const categoryConfig: Record<string, { label: string; color: string }> = {
  document_request: { label: "Document Request", color: "bg-blue-100 text-blue-700" },
  question: { label: "Question", color: "bg-purple-100 text-purple-700" },
  payment: { label: "Payment", color: "bg-green-100 text-green-700" },
  appointment: { label: "Appointment", color: "bg-amber-100 text-amber-700" },
  tax_filing: { label: "Tax Filing", color: "bg-red-100 text-red-700" },
  compliance: { label: "Compliance", color: "bg-orange-100 text-orange-700" },
  follow_up: { label: "Follow Up", color: "bg-cyan-100 text-cyan-700" },
  information: { label: "Information", color: "bg-slate-100 text-slate-700" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700" },
  internal: { label: "Internal", color: "bg-gray-100 text-gray-700" },
  other: { label: "Other", color: "bg-gray-100 text-gray-700" },
};

// Expandable Email Card Component
function ExpandableEmailCard({
  email,
  selected,
  onSelect,
  onQuickAction,
  onActionFeedback,
  onDragStart,
  onDragEnd,
  isDragging,
  isExpanded,
  onToggleExpand,
}: {
  email: EmailIntelligence;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onQuickAction: (action: string, actionItem?: ActionItem) => void;
  onActionFeedback: (actionId: string, feedback: "approved" | "rejected") => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const [showBody, setShowBody] = useState(false);

  const category = categoryConfig[email.category] || categoryConfig.other;

  // Safe access to from fields
  const fromName = email.from?.name || "";
  const fromEmail = email.from?.email || "unknown@email.com";
  const displayName = email.matchedClientName || fromName || fromEmail;

  // Safe date formatting
  const receivedDate = email.receivedAt instanceof Date
    ? email.receivedAt
    : new Date(email.receivedAt);
  const isReceivedDateValid = receivedDate instanceof Date && !isNaN(receivedDate.getTime());

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("emailId", email.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      className={cn(
        "transition-all border-border/50",
        selected && "ring-2 ring-primary bg-primary/5",
        isDragging && "opacity-50 ring-2 ring-primary",
        isExpanded && "bg-muted/30"
      )}
    >
      <CardContent className="p-0">
        {/* Main Card Header - Always Visible */}
        <div
          className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onToggleExpand}
        >
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            <div onClick={(e) => e.stopPropagation()} className="pt-1">
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(checked === true)}
              />
            </div>

            {/* Drag Handle */}
            <div className="pt-1 cursor-grab text-muted-foreground/50 hover:text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Avatar */}
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback
                className={cn(
                  email.matchedClientId
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {(fromName || fromEmail)
                  .split(" ")
                  .map((n) => n?.[0] || "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Header Row */}
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="font-medium truncate">
                  {displayName}
                </span>
                {email.matchedClientId && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5">
                    Client
                  </Badge>
                )}
                {email.hasAttachments && (
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground ml-auto" suppressHydrationWarning>
                  {isReceivedDateValid ? formatDistanceToNow(receivedDate, { addSuffix: true }) : "Unknown"}
                </span>
                {/* Expand indicator */}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Subject */}
              <p className="text-sm text-muted-foreground mb-2 truncate">
                {email.subject}
              </p>

              {/* Full AI Summary - Always Visible */}
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      {email.summary}
                    </p>
                    {/* Category and Priority Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {categoryIcons[email.category] || <Mail className="h-4 w-4" />}
                        <span className="ml-1">{category.label}</span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          email.sentiment === "positive" &&
                            "bg-green-100 text-green-700 border-green-200",
                          email.sentiment === "negative" &&
                            "bg-red-100 text-red-700 border-red-200",
                          email.sentiment === "neutral" &&
                            "bg-slate-100 text-slate-700 border-slate-200"
                        )}
                      >
                        {email.sentiment}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          email.priority === "urgent" &&
                            "bg-red-100 text-red-700 border-red-200",
                          email.priority === "high" &&
                            "bg-orange-100 text-orange-700 border-orange-200",
                          email.priority === "medium" &&
                            "bg-amber-100 text-amber-700 border-amber-200",
                          email.priority === "low" &&
                            "bg-green-100 text-green-700 border-green-200"
                        )}
                      >
                        {email.priority} priority
                      </Badge>
                      {email.requiresResponse && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-100 text-blue-700 border-blue-200"
                        >
                          Response Required
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Suggested Actions Preview */}
              {email.actionItems && email.actionItems.length > 0 && !isExpanded && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Actions:</span>
                  {email.actionItems.slice(0, 2).map((action) => (
                    <Badge
                      key={action.id}
                      variant="outline"
                      className="text-[10px] bg-background"
                    >
                      {action.title}
                    </Badge>
                  ))}
                  {email.actionItems.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{email.actionItems.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onQuickAction("reply")}>
                    <Mail className="h-4 w-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onQuickAction("call_back")}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call Back
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onQuickAction("create_task")}>
                    <ListTodo className="h-4 w-4 mr-2" />
                    Add to Tasks
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onQuickAction("complete")}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onQuickAction("dismiss")}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Dismiss
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t px-4 py-4 space-y-4">
            {/* Extracted Entities */}
            {(email.extractedDates?.length > 0 || email.extractedAmounts?.length > 0 || email.extractedNames?.length > 0) && (
              <div>
                <h4 className="text-sm font-medium mb-2">Extracted Information</h4>
                <div className="flex flex-wrap gap-2">
                  {email.extractedDates?.map((date, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs gap-1">
                      <Calendar className="h-3 w-3" />
                      {date.value}
                    </Badge>
                  ))}
                  {email.extractedAmounts?.map((amount, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
                      <DollarSign className="h-3 w-3" />
                      ${Number(amount.value).toLocaleString()}
                    </Badge>
                  ))}
                  {email.extractedNames?.map((person, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs gap-1">
                      <User className="h-3 w-3" />
                      {person.name}
                      {person.role && <span className="text-muted-foreground ml-1">({person.role})</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Actions with Feedback */}
            {email.actionItems && email.actionItems.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Suggested Actions
                  <span className="text-xs font-normal text-muted-foreground">
                    (Rate to improve AI)
                  </span>
                </h4>
                <div className="space-y-2">
                  {email.actionItems.map((action) => (
                    <div
                      key={action.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        action.userFeedback === "approved" && "bg-green-50 border-green-200",
                        action.userFeedback === "rejected" && "bg-red-50 border-red-200 opacity-60",
                        !action.userFeedback && "bg-muted/30"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{action.title}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              action.priority === "urgent" && "border-red-300 text-red-600",
                              action.priority === "high" && "border-orange-300 text-orange-600",
                              action.priority === "medium" && "border-amber-300 text-amber-600",
                              action.priority === "low" && "border-slate-300 text-slate-500"
                            )}
                          >
                            {action.priority}
                          </Badge>
                        </div>
                        {action.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {action.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8",
                                action.userFeedback === "approved"
                                  ? "text-green-600 bg-green-100 hover:bg-green-200"
                                  : "text-muted-foreground hover:text-green-600 hover:bg-green-50"
                              )}
                              onClick={() => onActionFeedback(action.id, "approved")}
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Helpful</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8",
                                action.userFeedback === "rejected"
                                  ? "text-red-600 bg-red-100 hover:bg-red-200"
                                  : "text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              )}
                              onClick={() => onActionFeedback(action.id, "rejected")}
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Not helpful</TooltipContent>
                        </Tooltip>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onQuickAction("do_action", action)}
                        disabled={action.userFeedback === "rejected"}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                        Do it
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Body Preview */}
            <Collapsible open={showBody} onOpenChange={setShowBody}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Email Content
                    {email.body && (
                      <Badge variant="secondary" className="text-[10px]">Available</Badge>
                    )}
                  </span>
                  {showBody ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {email.body ? (
                  email.bodyType === "html" ? (
                    <iframe
                      srcDoc={email.body}
                      className="w-full min-h-[200px] max-h-[300px] border-0 bg-white rounded-lg mt-2"
                      sandbox="allow-same-origin"
                      title="Email content"
                    />
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/50 p-3 rounded-lg max-h-[300px] overflow-y-auto mt-2">
                      {email.body}
                    </pre>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg text-center mt-2">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No email body available</p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Draft Response */}
            {email.draftResponse && (
              <div>
                <h4 className="text-sm font-medium mb-2">Suggested Response</h4>
                <pre className="text-sm whitespace-pre-wrap font-sans bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                  {email.draftResponse}
                </pre>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => onQuickAction("reply")}>
                <Mail className="h-4 w-4 mr-2" />
                Reply
              </Button>
              <Button variant="outline" size="sm" onClick={() => onQuickAction("call_back")}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
              <div className="flex-1" />
              <Button size="sm" onClick={() => onQuickAction("complete")}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Bottom Bucket Component
function BucketTray({
  buckets,
  onDrop,
  onCreateBucket,
  onDeleteBucket,
  onRenameBucket,
  dragOverBucketId,
  onDragOver,
  onDragLeave,
}: {
  buckets: EmailBucket[];
  onDrop: (bucketId: string, emailId: string) => void;
  onCreateBucket: (name: string, color: string) => void;
  onDeleteBucket: (bucketId: string) => void;
  onRenameBucket: (bucketId: string, name: string) => void;
  dragOverBucketId: string | null;
  onDragOver: (bucketId: string) => void;
  onDragLeave: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("bg-blue-500");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  return (
    <div className="h-20 border-t bg-muted/20 flex items-center px-6 gap-4 overflow-x-auto">
      {/* Existing Buckets */}
      {buckets.map((bucket) => (
        <div
          key={bucket.id}
          className={cn(
            "group relative flex-shrink-0 min-w-[160px] h-14 rounded-xl border transition-all flex items-center justify-center gap-2 px-4",
            dragOverBucketId === bucket.id
              ? "border-primary bg-primary/10 scale-105 shadow-md"
              : "border-border bg-card hover:bg-accent/50 hover:border-border/80"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            onDragOver(bucket.id);
          }}
          onDragLeave={onDragLeave}
          onDrop={(e) => {
            e.preventDefault();
            const emailId = e.dataTransfer.getData("emailId");
            if (emailId) {
              onDrop(bucket.id, emailId);
            }
            onDragLeave();
          }}
        >
          {editingId === bucket.id ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-7 text-sm w-24"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRenameBucket(bucket.id, editingName);
                    setEditingId(null);
                  } else if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  onRenameBucket(bucket.id, editingName);
                  setEditingId(null);
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className={cn("w-3 h-3 rounded-full flex-shrink-0", bucket.color)} />
              <span className="text-sm font-medium truncate">{bucket.name}</span>
              <Badge variant="secondary" className="text-xs px-2 h-5 ml-1">
                {bucket.emailIds.length}
              </Badge>
              {/* Edit/Delete buttons - shown on hover */}
              <div className="absolute -top-2 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6 rounded-full shadow-sm"
                  onClick={() => {
                    setEditingId(bucket.id);
                    setEditingName(bucket.name);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                {!bucket.isDefault && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-6 w-6 rounded-full shadow-sm text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => onDeleteBucket(bucket.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      ))}

      {/* Create New Bucket */}
      {isCreating ? (
        <div className="flex-shrink-0 min-w-[200px] h-14 rounded-xl border bg-card p-2 flex items-center gap-2">
          <Input
            placeholder="Bucket name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 text-sm flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onCreateBucket(newName.trim(), newColor);
                setNewName("");
                setIsCreating(false);
              } else if (e.key === "Escape") {
                setIsCreating(false);
                setNewName("");
              }
            }}
          />
          <div className="flex items-center gap-1">
            {bucketColors.slice(0, 4).map((color) => (
              <button
                key={color.name}
                onClick={() => setNewColor(color.class)}
                className={cn(
                  "w-5 h-5 rounded-full transition-all",
                  color.class,
                  newColor === color.class && "ring-2 ring-offset-1 ring-primary"
                )}
              />
            ))}
          </div>
          <Button
            size="sm"
            className="h-8 px-3"
            onClick={() => {
              if (newName.trim()) {
                onCreateBucket(newName.trim(), newColor);
                setNewName("");
                setIsCreating(false);
              }
            }}
            disabled={!newName.trim()}
          >
            Add
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setIsCreating(false);
              setNewName("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="flex-shrink-0 h-14 px-5 rounded-xl border-dashed hover:bg-accent/50"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Bucket
        </Button>
      )}

      {/* Drag hint */}
      <div className="flex-shrink-0 text-xs text-muted-foreground/70 ml-auto italic">
        Drag emails to organize
      </div>
    </div>
  );
}

// Loading skeleton
function EmailCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-48 mb-2" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    </Card>
  );
}

function EmailIntelligenceContent() {
  const [mounted, setMounted] = useState(false);
  const [intelligences, setIntelligences] = useState<EmailIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConnection, setNeedsConnection] = useState(false);

  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Bucket state
  const [buckets, setBuckets] = useState<EmailBucket[]>(defaultBuckets);
  const [draggingEmailId, setDraggingEmailId] = useState<string | null>(null);
  const [dragOverBucketId, setDragOverBucketId] = useState<string | null>(null);

  // Infinite scroll state
  const ITEMS_PER_PAGE = 20;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Team members for task assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Task creation dialog state
  const [taskCreation, setTaskCreation] = useState<TaskCreationState>({
    open: false,
    emailId: null,
    actionType: "",
    title: "",
    description: "",
    priority: "medium",
    assignedTo: "",
  });
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load email intelligences
  const loadIntelligences = useCallback(async () => {
    setError(null);
    setNeedsConnection(false);
    try {
      const res = await fetch("/api/email-intelligence?status=pending");
      if (res.ok) {
        const data = await res.json();
        setIntelligences(data.intelligences || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.needsConnection) {
          setNeedsConnection(true);
          setIntelligences([]);
        } else {
          setError(errorData.error || "Failed to load email intelligence data");
          setIntelligences([]);
        }
      }
    } catch (err) {
      console.error("Failed to load intelligences:", err);
      setError("Unable to connect to server. Please check your connection and try again.");
      setIntelligences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load team members
  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setTeamMembers((data.users || []).map((u: { id: string; full_name: string; email: string }) => ({
          id: u.id,
          name: u.full_name || u.email,
          email: u.email,
        })));
      }
    } catch (err) {
      console.error("Failed to load team members:", err);
    }
  }, []);

  useEffect(() => {
    loadIntelligences();
    loadTeamMembers();
  }, [loadIntelligences, loadTeamMembers]);

  // Realtime subscription for new email classifications
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("email-intelligence-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "email_classifications",
        },
        (payload) => {
          console.log("[Email Intelligence] New email classified:", payload.new);
          // Refetch to get the full data with action items
          loadIntelligences();
          toast.info("New email received and classified", {
            description: (payload.new as { subject?: string })?.subject || "New email",
            duration: 4000,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "email_classifications",
        },
        () => {
          // Silently refresh on updates
          loadIntelligences();
        }
      )
      .subscribe((status) => {
        console.log("[Email Intelligence] Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadIntelligences]);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery]);

  // Filter emails
  const filteredEmails = useMemo(() => {
    let result = intelligences;

    // Filter out emails in buckets (show only "inbox" emails in main list)
    const allBucketEmailIds = new Set(buckets.flatMap((b) => b.emailIds));
    result = result.filter((e) => !allBucketEmailIds.has(e.id));

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.from?.name?.toLowerCase().includes(query) ||
          e.from?.email?.toLowerCase().includes(query) ||
          e.subject?.toLowerCase().includes(query) ||
          e.summary?.toLowerCase().includes(query)
      );
    }

    return [...result].sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }, [intelligences, buckets, searchQuery]);

  const visibleEmails = useMemo(() => {
    return filteredEmails.slice(0, visibleCount);
  }, [filteredEmails, visibleCount]);

  const hasMoreEmails = visibleCount < filteredEmails.length;

  // Intersection observer for infinite scroll
  useEffect(() => {
    const loadMoreElement = loadMoreRef.current;
    if (!loadMoreElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreEmails) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredEmails.length));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [hasMoreEmails, filteredEmails.length]);

  // Sync emails
  const handleSync = async () => {
    setSyncing(true);
    toast.loading("Syncing emails... This may take a minute as AI processes each email.", {
      id: "email-sync",
      duration: 60000,
    });
    try {
      const res = await fetch("/api/email-intelligence/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Processed ${data.processed} new emails${data.tasksCreated ? `, created ${data.tasksCreated} tasks` : ""}`, {
          id: "email-sync",
        });
        loadIntelligences();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to sync emails", {
          id: "email-sync",
        });
      }
    } catch {
      toast.error("Failed to sync emails. Please try again.", {
        id: "email-sync",
      });
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync on first load if email account is connected but no emails processed yet
  const autoSyncAttempted = useRef(false);
  useEffect(() => {
    // Only run once when loading completes
    if (loading || autoSyncAttempted.current || syncing) return;

    // If we have emails or errors, don't auto-sync
    if (intelligences.length > 0 || error || needsConnection) return;

    // Check if there's a connected email account
    const checkAndSync = async () => {
      try {
        const accountRes = await fetch("/api/email/accounts");
        if (accountRes.ok) {
          const accountData = await accountRes.json();
          if (accountData.accounts && accountData.accounts.length > 0) {
            autoSyncAttempted.current = true;
            // Auto-trigger sync
            toast.info("Auto-syncing emails with AI analysis...", { id: "auto-sync-info", duration: 3000 });
            handleSync();
          }
        }
      } catch (err) {
        console.error("Failed to check accounts for auto-sync:", err);
      }
    };

    checkAndSync();
  }, [loading, intelligences.length, error, needsConnection, syncing]);

  // Bucket handlers
  const handleCreateBucket = useCallback((name: string, color: string) => {
    const newBucket: EmailBucket = {
      id: `bucket-${Date.now()}`,
      name,
      color,
      emailIds: [],
    };
    setBuckets((prev) => [...prev, newBucket]);
  }, []);

  const handleDeleteBucket = useCallback((bucketId: string) => {
    setBuckets((prev) => prev.filter((b) => b.id !== bucketId));
  }, []);

  const handleRenameBucket = useCallback((bucketId: string, name: string) => {
    setBuckets((prev) =>
      prev.map((b) => (b.id === bucketId ? { ...b, name } : b))
    );
  }, []);

  const handleDropToBucket = useCallback((bucketId: string, emailId: string) => {
    setBuckets((prev) =>
      prev.map((b) => {
        if (b.id === bucketId) {
          return { ...b, emailIds: [...new Set([...b.emailIds, emailId])] };
        }
        // Remove from other buckets
        return { ...b, emailIds: b.emailIds.filter((id) => id !== emailId) };
      })
    );
    toast.success("Email moved to bucket");
  }, []);

  // Selection handlers
  const handleSelect = useCallback((emailId: string, selected: boolean) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(emailId);
      } else {
        next.delete(emailId);
      }
      return next;
    });
  }, []);

  // Action feedback handler
  const handleActionFeedback = useCallback((emailId: string, actionId: string, feedback: "approved" | "rejected") => {
    setIntelligences((prev) =>
      prev.map((email) => {
        if (email.id !== emailId) return email;
        return {
          ...email,
          actionItems: email.actionItems?.map((action) =>
            action.id === actionId ? { ...action, userFeedback: feedback } : action
          ) || [],
        };
      })
    );
    toast.success(feedback === "approved" ? "Marked as helpful" : "Marked as not helpful");
  }, []);

  // Quick action handler
  const handleQuickAction = useCallback(
    (emailId: string, action: string, actionItem?: ActionItem) => {
      const email = intelligences.find((e) => e.id === emailId);
      if (!email) return;

      switch (action) {
        case "complete":
          setIntelligences((prev) =>
            prev.map((e) => (e.id === emailId ? { ...e, status: "approved" as const } : e))
          );
          toast.success("Email marked as complete");
          setExpandedEmailId(null);
          break;
        case "dismiss":
          setIntelligences((prev) =>
            prev.map((e) => (e.id === emailId ? { ...e, status: "dismissed" as const } : e))
          );
          toast.success("Email dismissed");
          setExpandedEmailId(null);
          break;
        case "reply":
          toast.info("Email reply feature coming soon");
          break;
        case "call_back":
          toast.info("Call back feature coming soon");
          break;
        case "create_task":
          // Open task creation dialog with first action item or default
          const firstAction = email.actionItems?.[0];
          setTaskCreation({
            open: true,
            emailId: emailId,
            actionType: firstAction?.type || "task",
            title: firstAction?.title || email.primaryAction || `Follow up on email: ${email.subject}`,
            description: firstAction?.description || email.summary || "",
            priority: firstAction?.priority || email.priority || "medium",
            assignedTo: "",
          });
          break;
        case "do_action":
          // Open task creation dialog with specific action item
          if (actionItem) {
            setTaskCreation({
              open: true,
              emailId: emailId,
              actionType: actionItem.type,
              title: actionItem.title,
              description: actionItem.description || email.summary || "",
              priority: actionItem.priority,
              assignedTo: "",
            });
          }
          break;
        default:
          break;
      }
    },
    [intelligences]
  );

  // Create task from dialog
  const handleCreateTask = useCallback(async () => {
    if (!taskCreation.emailId || !taskCreation.title.trim()) return;

    const email = intelligences.find((e) => e.id === taskCreation.emailId);
    if (!email) return;

    setIsCreatingTask(true);

    try {
      const response = await fetch("/api/tasks/from-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskCreation.title,
          description: taskCreation.description,
          priority: taskCreation.priority,
          type: taskCreation.actionType,
          sourceType: "email",
          sourceId: taskCreation.emailId,
          assignedTo: taskCreation.assignedTo || undefined,
          clientId: email.matchedClientId || undefined,
          metadata: {
            emailFrom: email.from?.email,
            emailSubject: email.subject,
            emailCategory: email.category,
          },
        }),
      });

      if (response.ok) {
        const assigneeName = teamMembers.find((m) => m.id === taskCreation.assignedTo)?.name;
        toast.success(
          assigneeName
            ? `Task created and assigned to ${assigneeName}`
            : "Task created successfully"
        );
        setTaskCreation((prev) => ({ ...prev, open: false }));
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create task");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setIsCreatingTask(false);
    }
  }, [taskCreation, intelligences, teamMembers]);

  // Stats
  const pendingCount = intelligences.filter((i) => i.status === "pending").length;
  const totalActionItems = intelligences.reduce((sum, i) => sum + (i.actionItems?.length || 0), 0);

  return (
    <TooltipProvider delayDuration={0}>
      <Header title="AI Email Intelligence" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-medium">AI Email Intelligence</span>
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </div>

          {/* Search */}
          <div className="relative ml-4">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[250px] h-8 pl-9 text-sm"
            />
          </div>

          <div className="flex-1" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{pendingCount} pending</span>
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

          <div className="h-4 border-l mx-2" />

          <span className="text-sm text-muted-foreground">
            {filteredEmails.length} emails
          </span>
        </div>

        {/* Main Email List */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2 max-w-7xl mx-auto 2xl:max-w-none 2xl:px-8">
              {loading && (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <EmailCardSkeleton key={i} />
                  ))}
                </>
              )}
              {mounted && !loading && error && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Failed to Load Emails</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md">
                    {error}
                  </p>
                  <Button onClick={loadIntelligences} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              )}
              {mounted && !loading && needsConnection && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                    <Mail className="h-8 w-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Email Account Connected</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md">
                    Connect your Microsoft 365 email account to start syncing and processing emails with AI.
                  </p>
                  <Button asChild>
                    <Link href="/settings?tab=integrations">
                      <Mail className="h-4 w-4 mr-2" />
                      Connect Email Account
                    </Link>
                  </Button>
                </div>
              )}
              {mounted && !loading && !error && !needsConnection && filteredEmails.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Inbox className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No emails to process</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    All caught up! No pending emails need your attention.
                  </p>
                  <Button onClick={handleSync} disabled={syncing}>
                    {syncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {syncing ? "Syncing emails..." : "Sync New Emails"}
                  </Button>
                </div>
              )}
              {mounted && !loading && !error && !needsConnection &&
                visibleEmails.map((email) => (
                  <ExpandableEmailCard
                    key={email.id}
                    email={email}
                    selected={selectedEmails.has(email.id)}
                    onSelect={(selected) => handleSelect(email.id, selected)}
                    onQuickAction={(action, actionItem) => handleQuickAction(email.id, action, actionItem)}
                    onActionFeedback={(actionId, feedback) => handleActionFeedback(email.id, actionId, feedback)}
                    onDragStart={() => setDraggingEmailId(email.id)}
                    onDragEnd={() => setDraggingEmailId(null)}
                    isDragging={draggingEmailId === email.id}
                    isExpanded={expandedEmailId === email.id}
                    onToggleExpand={() =>
                      setExpandedEmailId(expandedEmailId === email.id ? null : email.id)
                    }
                  />
                ))}
              {mounted && !loading && hasMoreEmails && (
                <div
                  ref={loadMoreRef}
                  className="py-4 text-center text-sm text-muted-foreground"
                >
                  Loading more...
                </div>
              )}
              {mounted && !loading && filteredEmails.length > 0 && !hasMoreEmails && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Showing all {filteredEmails.length} emails
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Bottom Bucket Tray */}
        <BucketTray
          buckets={buckets}
          onDrop={handleDropToBucket}
          onCreateBucket={handleCreateBucket}
          onDeleteBucket={handleDeleteBucket}
          onRenameBucket={handleRenameBucket}
          dragOverBucketId={dragOverBucketId}
          onDragOver={setDragOverBucketId}
          onDragLeave={() => setDragOverBucketId(null)}
        />

        {/* Task Creation Dialog */}
        <Dialog open={taskCreation.open} onOpenChange={(open) => setTaskCreation((prev) => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Create Task
              </DialogTitle>
              <DialogDescription>
                Create a task from this email&apos;s action item.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="task-title">Task Title</Label>
                <Input
                  id="task-title"
                  value={taskCreation.title}
                  onChange={(e) => setTaskCreation((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title..."
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={taskCreation.description}
                  onChange={(e) => setTaskCreation((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Add more details..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={taskCreation.priority}
                    onValueChange={(value) => setTaskCreation((prev) => ({
                      ...prev,
                      priority: value as "low" | "medium" | "high" | "urgent"
                    }))}
                  >
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

                {/* Assignee */}
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select
                    value={taskCreation.assignedTo}
                    onValueChange={(value) => setTaskCreation((prev) => ({ ...prev, assignedTo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        <span className="text-muted-foreground">Unassigned</span>
                      </SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px] bg-primary/10">
                                {member.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {member.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTaskCreation((prev) => ({ ...prev, open: false }))}
                disabled={isCreatingTask}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTask}
                disabled={!taskCreation.title.trim() || isCreatingTask}
              >
                {isCreatingTask ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create Task
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </TooltipProvider>
  );
}

export default function EmailIntelligencePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <EmailIntelligenceContent />
    </Suspense>
  );
}
