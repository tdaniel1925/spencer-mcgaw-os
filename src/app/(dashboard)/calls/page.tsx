"use client";

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ConfirmationDialog,
  useBulkActionConfirmation,
  useDeleteConfirmation,
} from "@/components/ui/confirmation-dialog";
import {
  Phone,
  Bot,
  Clock,
  User,
  FileText,
  ArrowRight,
  AlertTriangle,
  DollarSign,
  Calendar,
  HelpCircle,
  Archive,
  Trash2,
  UserPlus,
  MoreHorizontal,
  ListTodo,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Mail,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
  FormInput,
  Globe,
  Pencil,
  X,
  ThumbsUp,
  ThumbsDown,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  ExternalLink,
  Plus,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { useCalls } from "@/lib/calls";
import {
  CallRecord,
  CallCategory,
  callCategoryInfo,
} from "@/lib/calls/types";

// Bucket type for bottom tray
interface CallBucket {
  id: string;
  name: string;
  color: string;
  callIds: string[];
  isDefault?: boolean;
}

// Default buckets
const defaultBuckets: CallBucket[] = [
  { id: "follow-up", name: "Follow Up", color: "bg-amber-500", callIds: [], isDefault: true },
  { id: "callback", name: "Callback Needed", color: "bg-blue-500", callIds: [], isDefault: true },
  { id: "archive", name: "Archive", color: "bg-slate-500", callIds: [], isDefault: true },
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

// Team member type
interface TeamMember {
  id: string;
  name: string;
  email: string;
}

// Task creation dialog state
interface TaskCreationState {
  open: boolean;
  callId: string | null;
  actionType: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo: string;
}

// Category icons mapping
const categoryIcons: Record<CallCategory, React.ReactNode> = {
  new_client_inquiry: <UserPlus className="h-4 w-4" />,
  existing_client_question: <HelpCircle className="h-4 w-4" />,
  document_request: <FileText className="h-4 w-4" />,
  appointment_scheduling: <Calendar className="h-4 w-4" />,
  payment_inquiry: <DollarSign className="h-4 w-4" />,
  tax_question: <FileText className="h-4 w-4" />,
  status_check: <Search className="h-4 w-4" />,
  complaint: <AlertTriangle className="h-4 w-4" />,
  urgent_matter: <AlertCircle className="h-4 w-4" />,
  follow_up: <Clock className="h-4 w-4" />,
  voicemail: <MessageSquare className="h-4 w-4" />,
  wrong_number: <Phone className="h-4 w-4" />,
  spam: <Trash2 className="h-4 w-4" />,
  web_form: <FormInput className="h-4 w-4" />,
  contact_request: <Mail className="h-4 w-4" />,
  general_inquiry: <Globe className="h-4 w-4" />,
  other: <Phone className="h-4 w-4" />,
};

// Format duration
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Expandable Call Card Component
function ExpandableCallCard({
  call,
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
  call: CallRecord;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onQuickAction: (action: string) => void;
  onActionFeedback: (actionId: string, feedback: "approved" | "rejected") => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const [note, setNote] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);

  const category = (call.aiAnalysis?.category as CallCategory) || "other";
  const categoryInfo = callCategoryInfo[category] || callCategoryInfo["other"];

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("callId", call.id);
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
                  call.matchedClientId
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {call.callerName
                  ? call.callerName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : <Phone className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Header Row */}
              <div className="flex items-center gap-2 mb-1">
                {call.direction === "inbound" ? (
                  <PhoneIncoming className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <PhoneOutgoing className="h-4 w-4 text-blue-600 flex-shrink-0" />
                )}
                <span className="font-medium">
                  {call.callerName || call.callerPhone}
                </span>
                {call.lineUser?.name && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {call.lineUser.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto" suppressHydrationWarning>
                  {formatDistanceToNow(call.callStartedAt, { addSuffix: true })}
                </span>
                {/* Expand indicator */}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Phone and Duration */}
              <div className="text-xs text-muted-foreground mb-2">
                {call.callerPhone} • {formatDuration(call.durationSeconds)}
                {call.lineUser?.extension && (
                  <span> • Ext. {call.lineUser.extension}</span>
                )}
              </div>

              {/* Full AI Summary - Always Visible */}
              {call.aiAnalysis && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                  <div className="flex items-start gap-2">
                    <Bot className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {call.aiAnalysis.summary}
                      </p>
                      {/* Category and Sentiment Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryIcons[category] || <Phone className="h-4 w-4" />}
                          <span className="ml-1">{categoryInfo?.label || "Other"}</span>
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            call.aiAnalysis.sentiment === "positive" &&
                              "bg-green-100 text-green-700 border-green-200",
                            call.aiAnalysis.sentiment === "negative" &&
                              "bg-red-100 text-red-700 border-red-200",
                            call.aiAnalysis.sentiment === "frustrated" &&
                              "bg-orange-100 text-orange-700 border-orange-200",
                            call.aiAnalysis.sentiment === "neutral" &&
                              "bg-slate-100 text-slate-700 border-slate-200"
                          )}
                        >
                          {call.aiAnalysis.sentiment}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            call.aiAnalysis.urgency === "high" &&
                              "bg-red-100 text-red-700 border-red-200",
                            call.aiAnalysis.urgency === "medium" &&
                              "bg-amber-100 text-amber-700 border-amber-200",
                            call.aiAnalysis.urgency === "low" &&
                              "bg-green-100 text-green-700 border-green-200"
                          )}
                        >
                          {call.aiAnalysis.urgency} priority
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Actions Preview */}
              {call.aiAnalysis?.suggestedActions && call.aiAnalysis.suggestedActions.length > 0 && !isExpanded && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Actions:</span>
                  {call.aiAnalysis.suggestedActions.slice(0, 2).map((action) => (
                    <Badge
                      key={action.id}
                      variant="outline"
                      className="text-[10px] bg-background"
                    >
                      {action.label}
                    </Badge>
                  ))}
                  {call.aiAnalysis.suggestedActions.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{call.aiAnalysis.suggestedActions.length - 2} more
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
                  <DropdownMenuItem onClick={() => onQuickAction("call_back")}>
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Call Back
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onQuickAction("send_email")}>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
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
                    onClick={() => onQuickAction("delete")}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t px-4 py-4 space-y-4">
            {/* Key Points */}
            {call.aiAnalysis?.keyPoints && call.aiAnalysis.keyPoints.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Key Points</h4>
                <ul className="space-y-1">
                  {call.aiAnalysis.keyPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <ArrowRight className="h-3 w-3 mt-1 text-primary flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested Actions with Feedback */}
            {call.aiAnalysis?.suggestedActions && call.aiAnalysis.suggestedActions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Suggested Actions
                  <span className="text-xs font-normal text-muted-foreground">
                    (Rate to improve AI)
                  </span>
                </h4>
                <div className="space-y-2">
                  {call.aiAnalysis.suggestedActions.map((action) => (
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
                          <span className="font-medium text-sm">{action.label}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              action.priority === "high" && "border-orange-300 text-orange-600",
                              action.priority === "medium" && "border-amber-300 text-amber-600",
                              action.priority === "low" && "border-slate-300 text-slate-500"
                            )}
                          >
                            {action.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {action.description}
                        </p>
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
                        onClick={() => onQuickAction(action.type)}
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

            {/* Transcript */}
            <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Transcript
                    {call.transcript && (
                      <Badge variant="secondary" className="text-[10px]">Available</Badge>
                    )}
                  </span>
                  {showTranscript ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {call.transcript ? (
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/50 p-3 rounded-lg max-h-[300px] overflow-y-auto mt-2">
                    {call.transcript}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg text-center mt-2">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No transcript available</p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Notes */}
            <div>
              <h4 className="text-sm font-medium mb-2">Notes</h4>
              {call.notes && (
                <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/50 p-3 rounded-lg mb-2">
                  {call.notes}
                </pre>
              )}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  disabled={!note.trim()}
                  onClick={() => {
                    onQuickAction("add_note:" + note);
                    setNote("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => onQuickAction("call_back")}>
                <PhoneCall className="h-4 w-4 mr-2" />
                Call Back
              </Button>
              <Button variant="outline" size="sm" onClick={() => onQuickAction("send_email")}>
                <Mail className="h-4 w-4 mr-2" />
                Email
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
  buckets: CallBucket[];
  onDrop: (bucketId: string, callId: string) => void;
  onCreateBucket: (name: string, color: string) => void;
  onDeleteBucket: (bucketId: string) => void;
  onRenameBucket: (bucketId: string, name: string) => void;
  dragOverBucketId: string | null;
  onDragOver: (bucketId: string) => void;
  onDragLeave: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
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
            const callId = e.dataTransfer.getData("callId");
            if (callId) {
              onDrop(bucket.id, callId);
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
                <CheckCircle className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className={cn("w-3 h-3 rounded-full flex-shrink-0", bucket.color)} />
              <span className="text-sm font-medium truncate">{bucket.name}</span>
              <Badge variant="secondary" className="text-xs px-2 h-5 ml-1">
                {bucket.callIds.length}
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
        Drag calls to organize
      </div>
    </div>
  );
}

function CallsPageContent() {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    calls,
    updateCallStatus,
    addCallNote,
    archiveCall,
    deleteCall,
    updateActionFeedback,
  } = useCalls();

  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Bucket state
  const [buckets, setBuckets] = useState<CallBucket[]>(defaultBuckets);
  const [draggingCallId, setDraggingCallId] = useState<string | null>(null);
  const [dragOverBucketId, setDragOverBucketId] = useState<string | null>(null);

  // Infinite scroll state
  const ITEMS_PER_PAGE = 20;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Confirmation dialogs
  const { confirmDelete, state: deleteState, setOpen: setDeleteOpen } = useDeleteConfirmation();
  const { confirmBulkAction, state: bulkState, setOpen: setBulkOpen } = useBulkActionConfirmation();

  // Team members for task assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Task creation dialog state
  const [taskCreation, setTaskCreation] = useState<TaskCreationState>({
    open: false,
    callId: null,
    actionType: "",
    title: "",
    description: "",
    priority: "medium",
    assignedTo: "",
  });
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // GoTo integration state
  const [gotoStatus, setGotoStatus] = useState<{
    status: "connected" | "disconnected" | "loading" | "error";
    accountKey?: string | null;
    errorMessage?: string | null;
    authUrl?: string;
  }>({ status: "loading" });
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle OAuth callback parameters
  useEffect(() => {
    const gotoConnected = searchParams.get("goto_connected");
    const gotoError = searchParams.get("goto_error");
    const errorMessage = searchParams.get("error_message");
    const accountKey = searchParams.get("account_key");

    if (gotoConnected === "true") {
      toast.success("GoTo Connect Connected!", {
        description: accountKey
          ? `Account ${accountKey} is now connected`
          : "Your phone system is now integrated",
      });
      setGotoStatus((prev) => ({
        ...prev,
        status: "connected",
        accountKey: accountKey || prev.accountKey,
        errorMessage: null,
      }));
      router.replace("/calls", { scroll: false });
    } else if (gotoError === "true") {
      toast.error("Failed to connect GoTo", {
        description: errorMessage || "Please try again",
      });
      router.replace("/calls", { scroll: false });
    }
  }, [searchParams, router]);

  // Fetch GoTo integration status
  useEffect(() => {
    async function fetchGotoStatus() {
      try {
        const res = await fetch("/api/integrations/goto");
        const data = await res.json();
        setGotoStatus({
          status: data.status === "connected" ? "connected" : "disconnected",
          accountKey: data.accountKey,
          errorMessage: data.errorMessage,
          authUrl: data.authUrl,
        });
      } catch (error) {
        setGotoStatus({
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Failed to fetch status",
        });
      }
    }
    fetchGotoStatus();
  }, []);

  // Load team members for task assignment
  useEffect(() => {
    async function loadTeamMembers() {
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
    }
    loadTeamMembers();
  }, []);

  // Test GoTo connection
  const testGotoConnection = useCallback(async () => {
    setIsTestingConnection(true);
    try {
      const res = await fetch("/api/integrations/goto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      setGotoStatus((prev) => ({
        ...prev,
        status: data.success ? "connected" : "disconnected",
        accountKey: data.accountKey,
        errorMessage: data.errorMessage,
        authUrl: data.authUrl || prev.authUrl,
      }));
    } catch (error) {
      setGotoStatus((prev) => ({
        ...prev,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Connection test failed",
      }));
    } finally {
      setIsTestingConnection(false);
    }
  }, []);

  const reconnectGoto = useCallback(() => {
    if (gotoStatus.authUrl) {
      window.location.href = gotoStatus.authUrl;
    }
  }, [gotoStatus.authUrl]);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery]);

  // Filter calls
  const filteredCalls = useMemo(() => {
    let result = calls;

    // Filter out calls in buckets (show only "inbox" calls in main list)
    const allBucketCallIds = new Set(buckets.flatMap((b) => b.callIds));
    result = result.filter((c) => !allBucketCallIds.has(c.id));

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.callerName?.toLowerCase().includes(query) ||
          c.callerPhone.includes(query) ||
          c.aiAnalysis?.summary.toLowerCase().includes(query)
      );
    }

    return [...result].sort(
      (a, b) =>
        new Date(b.callStartedAt).getTime() - new Date(a.callStartedAt).getTime()
    );
  }, [calls, buckets, searchQuery]);

  const visibleCalls = useMemo(() => {
    return filteredCalls.slice(0, visibleCount);
  }, [filteredCalls, visibleCount]);

  const hasMoreCalls = visibleCount < filteredCalls.length;

  // Intersection observer for infinite scroll
  useEffect(() => {
    const loadMoreElement = loadMoreRef.current;
    if (!loadMoreElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreCalls) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredCalls.length));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [hasMoreCalls, filteredCalls.length]);

  // Bucket handlers
  const handleCreateBucket = useCallback((name: string, color: string) => {
    const newBucket: CallBucket = {
      id: `bucket-${Date.now()}`,
      name,
      color,
      callIds: [],
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

  const handleDropToBucket = useCallback((bucketId: string, callId: string) => {
    setBuckets((prev) =>
      prev.map((b) => {
        if (b.id === bucketId) {
          return { ...b, callIds: [...new Set([...b.callIds, callId])] };
        }
        // Remove from other buckets
        return { ...b, callIds: b.callIds.filter((id) => id !== callId) };
      })
    );
    toast.success("Call moved to bucket");
  }, []);

  // Selection handlers
  const handleSelect = useCallback((callId: string, selected: boolean) => {
    setSelectedCalls((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(callId);
      } else {
        next.delete(callId);
      }
      return next;
    });
  }, []);

  // Quick action handler
  const handleQuickAction = useCallback(
    (callId: string, action: string) => {
      const call = calls.find((c) => c.id === callId);
      if (!call) return;

      if (action.startsWith("add_note:")) {
        const noteContent = action.replace("add_note:", "");
        addCallNote(callId, noteContent);
        return;
      }

      switch (action) {
        case "complete":
          updateCallStatus(callId, "completed");
          setExpandedCallId(null);
          break;
        case "archive":
          archiveCall(callId);
          setExpandedCallId(null);
          break;
        case "delete":
          confirmDelete({
            title: "Delete Call Record",
            description: `Are you sure you want to delete the call from ${call?.callerName || "Unknown Caller"}?`,
            onConfirm: () => {
              deleteCall(callId);
              setSelectedCalls((prev) => {
                const next = new Set(prev);
                next.delete(callId);
                return next;
              });
              setExpandedCallId(null);
            },
          });
          break;
        case "call_back":
          toast.info("Call back feature coming soon");
          break;
        case "send_email":
          toast.info("Email feature coming soon");
          break;
        case "create_task":
          // Open task creation dialog
          setTaskCreation({
            open: true,
            callId: callId,
            actionType: "general",
            title: call.aiAnalysis?.suggestedActions?.[0]?.label || `Follow up on call from ${call.callerName || call.callerPhone}`,
            description: call.aiAnalysis?.summary || "",
            priority: (call.aiAnalysis?.urgency === "high" ? "high" : call.aiAnalysis?.urgency === "medium" ? "medium" : "low") as "low" | "medium" | "high",
            assignedTo: "",
          });
          break;
        default:
          // Handle action types from suggested actions (e.g., "call_back", "send_email")
          if (["call_back", "send_email", "schedule_appointment", "document_request", "follow_up", "review"].includes(action)) {
            const suggestedAction = call.aiAnalysis?.suggestedActions?.find(a => a.type === action);
            setTaskCreation({
              open: true,
              callId: callId,
              actionType: action,
              title: suggestedAction?.label || `${action.replace("_", " ")} - ${call.callerName || call.callerPhone}`,
              description: suggestedAction?.description || call.aiAnalysis?.summary || "",
              priority: (suggestedAction?.priority === "high" ? "high" : suggestedAction?.priority === "medium" ? "medium" : "low") as "low" | "medium" | "high",
              assignedTo: "",
            });
          }
          break;
      }
    },
    [calls, updateCallStatus, archiveCall, deleteCall, addCallNote, confirmDelete]
  );

  // Create task from dialog
  const handleCreateTask = useCallback(async () => {
    if (!taskCreation.callId || !taskCreation.title.trim()) return;

    const call = calls.find(c => c.id === taskCreation.callId);
    if (!call) return;

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
          sourceType: "phone_call",
          sourceId: taskCreation.callId,
          assignedTo: taskCreation.assignedTo || undefined,
          clientId: call.matchedClientId || undefined,
          metadata: {
            callerPhone: call.callerPhone,
            callerName: call.callerName,
            callCategory: call.aiAnalysis?.category,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assigneeName = teamMembers.find(m => m.id === taskCreation.assignedTo)?.name;
        toast.success(
          assigneeName
            ? `Task created and assigned to ${assigneeName}`
            : "Task created successfully"
        );
        setTaskCreation(prev => ({ ...prev, open: false }));
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
  }, [taskCreation, calls, teamMembers]);

  return (
    <TooltipProvider delayDuration={0}>
      <Header title="AI Phone Agent" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <span className="font-medium">AI Phone Agent</span>
          </div>

          {/* Search */}
          <div className="relative ml-4">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[250px] h-8 pl-9 text-sm"
            />
          </div>

          <div className="flex-1" />

          {/* GoTo Connection Status */}
          <div className="flex items-center gap-2">
            {gotoStatus.status === "loading" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking...</span>
              </div>
            ) : gotoStatus.status === "connected" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-sm text-green-600">
                    <Wifi className="h-4 w-4" />
                    <span>GoTo Connected</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>GoTo Connect is active</p>
                  {gotoStatus.accountKey && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Account: {gotoStatus.accountKey}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-sm text-amber-600">
                    <WifiOff className="h-4 w-4" />
                    <span>GoTo Disconnected</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>GoTo Connect is not connected</p>
                  {gotoStatus.errorMessage && (
                    <p className="text-xs text-destructive mt-1">
                      {gotoStatus.errorMessage}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={testGotoConnection}
                  disabled={isTestingConnection}
                >
                  {isTestingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Test Connection</TooltipContent>
            </Tooltip>

            {gotoStatus.status !== "connected" && gotoStatus.authUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={reconnectGoto}
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Reconnect
              </Button>
            )}
          </div>

          <div className="h-4 border-l mx-2" />

          <span className="text-sm text-muted-foreground">
            {filteredCalls.length} calls
          </span>
        </div>

        {/* Main Calls List */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2 max-w-6xl mx-auto">
              {mounted && filteredCalls.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No calls to show</p>
                  <p className="text-sm mt-1">New calls will appear here</p>
                </div>
              )}
              {mounted &&
                visibleCalls.map((call) => (
                  <ExpandableCallCard
                    key={call.id}
                    call={call}
                    selected={selectedCalls.has(call.id)}
                    onSelect={(selected) => handleSelect(call.id, selected)}
                    onQuickAction={(action) => handleQuickAction(call.id, action)}
                    onActionFeedback={(actionId, feedback) =>
                      updateActionFeedback(call.id, actionId, feedback)
                    }
                    onDragStart={() => setDraggingCallId(call.id)}
                    onDragEnd={() => setDraggingCallId(null)}
                    isDragging={draggingCallId === call.id}
                    isExpanded={expandedCallId === call.id}
                    onToggleExpand={() =>
                      setExpandedCallId(expandedCallId === call.id ? null : call.id)
                    }
                  />
                ))}
              {mounted && hasMoreCalls && (
                <div
                  ref={loadMoreRef}
                  className="py-4 text-center text-sm text-muted-foreground"
                >
                  Loading more...
                </div>
              )}
              {mounted && filteredCalls.length > 0 && !hasMoreCalls && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Showing all {filteredCalls.length} calls
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

        {/* Confirmation Dialogs */}
        <ConfirmationDialog
          open={deleteState.open}
          onOpenChange={setDeleteOpen}
          title={deleteState.title}
          description={deleteState.description}
          confirmText={deleteState.confirmText}
          cancelText={deleteState.cancelText}
          variant={deleteState.variant}
          onConfirm={deleteState.onConfirm}
          itemCount={deleteState.itemCount}
          itemName={deleteState.itemName}
        />
        <ConfirmationDialog
          open={bulkState.open}
          onOpenChange={setBulkOpen}
          title={bulkState.title}
          description={bulkState.description}
          confirmText={bulkState.confirmText}
          cancelText={bulkState.cancelText}
          variant={bulkState.variant}
          onConfirm={bulkState.onConfirm}
          itemCount={bulkState.itemCount}
          itemName={bulkState.itemName}
        />

        {/* Task Creation Dialog */}
        <Dialog open={taskCreation.open} onOpenChange={(open) => setTaskCreation(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Create Task
              </DialogTitle>
              <DialogDescription>
                Create a task from this call&apos;s action item.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="task-title">Task Title</Label>
                <Input
                  id="task-title"
                  value={taskCreation.title}
                  onChange={(e) => setTaskCreation(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title..."
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={taskCreation.description}
                  onChange={(e) => setTaskCreation(prev => ({ ...prev, description: e.target.value }))}
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
                    onValueChange={(value) => setTaskCreation(prev => ({
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
                    onValueChange={(value) => setTaskCreation(prev => ({ ...prev, assignedTo: value }))}
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
                                {member.name.split(" ").map(n => n[0]).join("").toUpperCase()}
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
                onClick={() => setTaskCreation(prev => ({ ...prev, open: false }))}
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

export default function CallsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <CallsPageContent />
    </Suspense>
  );
}
