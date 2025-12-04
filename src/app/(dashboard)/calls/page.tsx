"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  Play,
  Pause,
  FileText,
  ArrowRight,
  AlertTriangle,
  DollarSign,
  Calendar,
  HelpCircle,
  Filter,
  Archive,
  Trash2,
  UserPlus,
  MoreHorizontal,
  CheckSquare,
  XSquare,
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
  Settings,
  Eye,
  FormInput,
  Globe,
  Folder,
  FolderPlus,
  FolderOpen,
  Inbox,
  Pencil,
  X,
  GripVertical,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { useCalls } from "@/lib/calls";
import {
  CallRecord,
  CallCategory,
  callCategoryInfo,
  callStatusInfo,
  urgencyInfo,
} from "@/lib/calls/types";

// Folder type
interface CallFolder {
  id: string;
  name: string;
  color: string;
  callIds: string[];
}

// Available folder colors
const folderColors = [
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

// Call Card Component
function CallCard({
  call,
  selected,
  onSelect,
  onClick,
  onQuickAction,
  onActionFeedback,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  call: CallRecord;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onClick: () => void;
  onQuickAction: (action: string) => void;
  onActionFeedback: (actionId: string, feedback: "approved" | "rejected") => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

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
        "transition-all hover:bg-muted/50 cursor-pointer border-border/50",
        selected && "ring-2 ring-primary bg-primary/5",
        isDragging && "opacity-50 ring-2 ring-primary"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          {/* Checkbox */}
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelect(checked === true)}
            />
          </div>

          {/* Avatar - smaller */}
          <Avatar className="h-8 w-8 flex-shrink-0" onClick={onClick}>
            <AvatarFallback
              className={cn(
                "text-xs",
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
                : <Phone className="h-3 w-3" />}
            </AvatarFallback>
          </Avatar>

          {/* Main content - single row layout */}
          <div className="flex-1 min-w-0 flex items-center gap-3" onClick={onClick}>
            {/* Name and phone */}
            <div className="min-w-[140px]">
              <div className="flex items-center gap-1.5">
                {call.direction === "inbound" ? (
                  <PhoneIncoming className="h-3 w-3 text-primary flex-shrink-0" />
                ) : (
                  <PhoneOutgoing className="h-3 w-3 text-primary/70 flex-shrink-0" />
                )}
                <span className="font-medium text-sm truncate">
                  {call.callerName || call.callerPhone}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {call.callerPhone} • {formatDuration(call.durationSeconds)}
              </p>
            </div>

            {/* AI Summary - compact */}
            {call.aiAnalysis && (
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {call.aiAnalysis.summary}
                </p>
              </div>
            )}
          </div>

          {/* Actionable Items Quick Feedback */}
          {call.aiAnalysis?.suggestedActions && call.aiAnalysis.suggestedActions.length > 0 && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {call.aiAnalysis.suggestedActions.slice(0, 1).map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-1 px-2 py-0.5 bg-primary/5 rounded-full border border-primary/20"
                >
                  <span className="text-[10px] text-primary font-medium truncate max-w-[80px]">
                    {action.label}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-5 w-5",
                            action.userFeedback === "approved"
                              ? "text-green-600 bg-green-100 hover:bg-green-200"
                              : "text-muted-foreground hover:text-green-600 hover:bg-green-50"
                          )}
                          onClick={() => onActionFeedback(action.id, "approved")}
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Relevant action</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-5 w-5",
                            action.userFeedback === "rejected"
                              ? "text-red-600 bg-red-100 hover:bg-red-200"
                              : "text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          )}
                          onClick={() => onActionFeedback(action.id, "rejected")}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Not relevant</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
              {call.aiAnalysis.suggestedActions.length > 1 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                  +{call.aiAnalysis.suggestedActions.length - 1}
                </Badge>
              )}
            </div>
          )}

          {/* Audio player button */}
          {call.recordingUrl && (
            <div onClick={(e) => e.stopPropagation()}>
              <audio
                ref={audioRef}
                src={call.recordingUrl}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
                onClick={toggleAudio}
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}

          {/* Time */}
          <span className="text-[10px] text-muted-foreground w-20 text-right flex-shrink-0" suppressHydrationWarning>
            {formatDistanceToNow(call.callStartedAt, { addSuffix: true })}
          </span>

          {/* Actions Menu */}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Call actions menu">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onQuickAction("view")}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onQuickAction("call_back")}>
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Call Back
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onQuickAction("send_email")}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onQuickAction("assign")}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign To...
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
                <DropdownMenuItem onClick={() => onQuickAction("archive")}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
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
      </CardContent>
    </Card>
  );
}

// Call Detail Modal
function CallDetailModal({
  call,
  open,
  onClose,
  onAction,
  onActionFeedback,
}: {
  call: CallRecord | null;
  open: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
  onActionFeedback: (actionId: string, feedback: "approved" | "rejected") => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [note, setNote] = useState("");

  if (!call) return null;

  const category = call.aiAnalysis?.category || "other";
  const categoryInfo = callCategoryInfo[category];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {call.direction === "inbound" ? (
              <PhoneIncoming className="h-5 w-5 text-green-600" />
            ) : (
              <PhoneOutgoing className="h-5 w-5 text-blue-600" />
            )}
            {call.callerName || call.callerPhone}
            {call.matchedClientName && (
              <Badge variant="outline" className="ml-2">
                <User className="h-3 w-3 mr-1" />
                {call.matchedClientName}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {format(call.callStartedAt, "MMMM d, yyyy 'at' h:mm a")} •{" "}
            {formatDuration(call.durationSeconds)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {/* Recording Player */}
            {call.recordingUrl && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1 h-2 bg-muted rounded-full">
                      <div className="w-1/3 h-full bg-primary rounded-full" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(call.durationSeconds)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Analysis */}
            {call.aiAnalysis && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    AI Analysis
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Math.round(call.aiAnalysis.confidence * 100)}% confidence
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Summary</p>
                    <p className="text-sm text-muted-foreground">
                      {call.aiAnalysis.summary}
                    </p>
                  </div>
                  {call.aiAnalysis.keyPoints.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Key Points</p>
                      <ul className="space-y-1">
                        {call.aiAnalysis.keyPoints.map((point, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-muted-foreground flex items-center gap-2"
                          >
                            <ArrowRight className="h-3 w-3 text-primary" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium mb-1">Caller Sentiment</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        call.aiAnalysis.sentiment === "positive" &&
                          "bg-green-100 text-green-700",
                        call.aiAnalysis.sentiment === "negative" &&
                          "bg-red-100 text-red-700",
                        call.aiAnalysis.sentiment === "frustrated" &&
                          "bg-orange-100 text-orange-700"
                      )}
                    >
                      {call.aiAnalysis.sentiment}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Actions with Feedback */}
            {call.aiAnalysis?.suggestedActions &&
              call.aiAnalysis.suggestedActions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      AI Suggested Actions
                      <span className="text-xs font-normal text-muted-foreground ml-auto">
                        Rate to improve AI
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                              {action.userFeedback && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px]",
                                    action.userFeedback === "approved" && "bg-green-100 text-green-700",
                                    action.userFeedback === "rejected" && "bg-red-100 text-red-700"
                                  )}
                                >
                                  {action.userFeedback === "approved" ? "Helpful" : "Not helpful"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {action.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <TooltipProvider delayDuration={0}>
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
                                <TooltipContent>This is helpful</TooltipContent>
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
                            </TooltipProvider>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAction(action.type)}
                            disabled={action.userFeedback === "rejected"}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                            Do it
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Transcript */}
            {call.transcript && (
              <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Transcript
                        </span>
                        {showTranscript ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/50 p-3 rounded-lg">
                        {call.transcript}
                      </pre>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {call.notes && (
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/50 p-3 rounded-lg mb-2">
                    {call.notes}
                  </pre>
                )}
                <Textarea
                  placeholder="Add a note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  disabled={!note.trim()}
                  onClick={() => {
                    onAction("add_note:" + note);
                    setNote("");
                  }}
                >
                  Add Note
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={() => onAction("call_back")}>
            <PhoneCall className="h-4 w-4 mr-2" />
            Call Back
          </Button>
          <Button onClick={() => onAction("complete")}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CallsPage() {
  const [mounted, setMounted] = useState(false);
  const {
    calls,
    updateCallStatus,
    addCallNote,
    archiveCall,
    deleteCall,
    updateActionFeedback,
  } = useCalls();

  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Folder state
  const [folders, setFolders] = useState<CallFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [draggingCallId, setDraggingCallId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("blue");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  // Infinite scroll state
  const ITEMS_PER_PAGE = 20;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Confirmation dialogs
  const { confirmDelete, state: deleteState, setOpen: setDeleteOpen } = useDeleteConfirmation();
  const { confirmBulkAction, state: bulkState, setOpen: setBulkOpen } = useBulkActionConfirmation();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset visible count when folder changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [selectedFolderId, searchQuery]);

  // Filter calls by folder and search
  const filteredCalls = useMemo(() => {
    let result = calls;

    // Filter by selected folder
    if (selectedFolderId === "inbox") {
      // Show only calls not in any folder
      const allFolderCallIds = new Set(folders.flatMap(f => f.callIds));
      result = result.filter(c => !allFolderCallIds.has(c.id));
    } else if (selectedFolderId !== null) {
      const folder = folders.find(f => f.id === selectedFolderId);
      if (folder) {
        result = result.filter(c => folder.callIds.includes(c.id));
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.callerName?.toLowerCase().includes(query) ||
          c.callerPhone.includes(query) ||
          c.aiAnalysis?.summary.toLowerCase().includes(query)
      );
    }

    // Sort by newest first
    return [...result].sort(
      (a, b) =>
        new Date(b.callStartedAt).getTime() - new Date(a.callStartedAt).getTime()
    );
  }, [calls, selectedFolderId, folders, searchQuery]);

  // Get calls not in any folder (inbox)
  const inboxCalls = useMemo(() => {
    const allFolderCallIds = new Set(folders.flatMap(f => f.callIds));
    return calls.filter(c => !allFolderCallIds.has(c.id));
  }, [calls, folders]);

  // Visible calls for infinite scroll
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
          setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredCalls.length));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [hasMoreCalls, filteredCalls.length]);

  // Folder management handlers
  const createFolder = useCallback(() => {
    if (!newFolderName.trim()) return;
    const newFolder: CallFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      color: newFolderColor,
      callIds: [],
    };
    setFolders(prev => [...prev, newFolder]);
    setNewFolderName("");
    setNewFolderColor("blue");
    setIsCreatingFolder(false);
  }, [newFolderName, newFolderColor]);

  const updateFolderName = useCallback((folderId: string, name: string) => {
    setFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, name } : f
    ));
    setEditingFolderId(null);
    setEditingFolderName("");
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    if (selectedFolderId === folderId) {
      setSelectedFolderId(null);
    }
  }, [selectedFolderId]);

  const addCallToFolder = useCallback((callId: string, folderId: string) => {
    setFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        // Remove from any other folder first
        return { ...f, callIds: [...new Set([...f.callIds, callId])] };
      }
      // Remove from other folders
      return { ...f, callIds: f.callIds.filter(id => id !== callId) };
    }));
  }, []);

  const removeCallFromFolder = useCallback((callId: string) => {
    setFolders(prev => prev.map(f => ({
      ...f,
      callIds: f.callIds.filter(id => id !== callId)
    })));
  }, []);

  const handleDrop = useCallback((folderId: string, e: React.DragEvent) => {
    e.preventDefault();
    const callId = e.dataTransfer.getData("callId");
    if (callId) {
      addCallToFolder(callId, folderId);
    }
    setDragOverFolderId(null);
    setDraggingCallId(null);
  }, [addCallToFolder]);

  const handleDragOver = useCallback((folderId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
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

  const handleSelectAll = useCallback(() => {
    setSelectedCalls(new Set(filteredCalls.map((c) => c.id)));
  }, [filteredCalls]);

  const handleDeselectAll = useCallback(() => {
    setSelectedCalls(new Set());
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
        case "view":
          setSelectedCall(call);
          break;
        case "complete":
          updateCallStatus(callId, "completed");
          break;
        case "archive":
          archiveCall(callId);
          break;
        case "delete":
          // Use confirmation dialog for delete
          confirmDelete({
            title: "Delete Call Record",
            description: `Are you sure you want to delete the call from ${call?.callerName || "Unknown Caller"}? This action cannot be undone.`,
            onConfirm: () => {
              deleteCall(callId);
              setSelectedCalls((prev) => {
                const next = new Set(prev);
                next.delete(callId);
                return next;
              });
            },
          });
          break;
        case "call_back":
          // Would trigger call functionality
          break;
        case "send_email":
          // Would open email compose
          break;
        case "assign":
          // Would open assign dialog
          break;
        case "create_task":
          // Would create task
          break;
      }
    },
    [calls, updateCallStatus, archiveCall, deleteCall, addCallNote, confirmDelete]
  );

  // Bulk action handler with confirmation
  const handleBulkAction = useCallback(
    async (action: string) => {
      const selectedIds = Array.from(selectedCalls);
      const count = selectedIds.length;

      // Actions requiring confirmation
      if (action === "delete" || action === "archive" || action === "complete") {
        await confirmBulkAction({
          action: action as "delete" | "archive" | "complete",
          itemCount: count,
          itemName: "call",
          onConfirm: () => {
            switch (action) {
              case "complete":
                selectedIds.forEach((id) => updateCallStatus(id, "completed"));
                break;
              case "archive":
                selectedIds.forEach((id) => archiveCall(id));
                break;
              case "delete":
                selectedIds.forEach((id) => deleteCall(id));
                break;
            }
            setSelectedCalls(new Set());
          },
        });
      } else {
        // Non-destructive actions execute immediately
        setSelectedCalls(new Set());
      }
    },
    [selectedCalls, updateCallStatus, archiveCall, deleteCall, confirmBulkAction]
  );

  // Single item delete with confirmation
  const handleDeleteCall = useCallback(
    (callId: string, callerName?: string) => {
      confirmDelete({
        title: "Delete Call Record",
        description: `Are you sure you want to delete the call from ${callerName || "Unknown Caller"}? This action cannot be undone.`,
        onConfirm: () => {
          deleteCall(callId);
        },
      });
    },
    [deleteCall, confirmDelete]
  );

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
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search calls..."
              aria-label="Search calls by name or phone number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[200px] h-8 pl-9 text-sm"
            />
          </div>

          <div className="flex-1" />

          {/* Total count */}
          <span className="text-sm text-muted-foreground">
            {calls.length} calls
          </span>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Folders Sidebar */}
          <div className="w-[200px] flex-shrink-0 border-r bg-muted/30 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                FOLDERS
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsCreatingFolder(true)}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create folder</TooltipContent>
              </Tooltip>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {/* All Calls */}
                <Button
                  variant={selectedFolderId === null ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelectedFolderId(null)}
                >
                  <Inbox className="h-4 w-4 mr-2" />
                  <span className="flex-1 text-left">All Calls</span>
                  <span className="text-xs text-muted-foreground">{calls.length}</span>
                </Button>

                {/* Inbox (uncategorized) */}
                <div
                  className={cn(
                    "flex items-center rounded-md",
                    dragOverFolderId === "inbox" && "ring-2 ring-primary bg-primary/10"
                  )}
                  onDragOver={(e) => handleDragOver("inbox", e)}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const callId = e.dataTransfer.getData("callId");
                    if (callId) {
                      removeCallFromFolder(callId);
                    }
                    setDragOverFolderId(null);
                    setDraggingCallId(null);
                  }}
                >
                  <Button
                    variant={selectedFolderId === "inbox" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedFolderId("inbox")}
                  >
                    <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="flex-1 text-left">Inbox</span>
                    <span className="text-xs text-muted-foreground">{inboxCalls.length}</span>
                  </Button>
                </div>

                {/* Custom Folders */}
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={cn(
                      "group flex items-center rounded-md",
                      dragOverFolderId === folder.id && "ring-2 ring-primary bg-primary/10"
                    )}
                    onDragOver={(e) => handleDragOver(folder.id, e)}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => handleDrop(folder.id, e)}
                  >
                    {editingFolderId === folder.id ? (
                      <div className="flex items-center gap-1 w-full p-1">
                        <Input
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateFolderName(folder.id, editingFolderName);
                            } else if (e.key === "Escape") {
                              setEditingFolderId(null);
                            }
                          }}
                          className="h-6 text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateFolderName(folder.id, editingFolderName)}
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start group"
                        onClick={() => setSelectedFolderId(folder.id)}
                      >
                        <div className={cn(
                          "w-3 h-3 rounded mr-2",
                          folderColors.find(c => c.name === folder.color)?.class || "bg-gray-500"
                        )} />
                        <Folder className="h-4 w-4 mr-1.5 text-muted-foreground" />
                        <span className="flex-1 text-left truncate">{folder.name}</span>
                        <span className="text-xs text-muted-foreground mr-1">
                          {folder.callIds.length}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-3 w-3" />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem onClick={() => {
                              setEditingFolderId(folder.id);
                              setEditingFolderName(folder.name);
                            }}>
                              <Pencil className="h-3 w-3 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteFolder(folder.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Create Folder Form */}
            {isCreatingFolder && (
              <div className="mt-3 p-2 border rounded-md bg-background space-y-2">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFolder();
                    if (e.key === "Escape") setIsCreatingFolder(false);
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="flex gap-1 flex-wrap">
                  {folderColors.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setNewFolderColor(color.name)}
                      className={cn(
                        "w-5 h-5 rounded transition-all",
                        color.class,
                        newFolderColor === color.name && "ring-2 ring-offset-1 ring-primary"
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={createFolder}
                    disabled={!newFolderName.trim()}
                  >
                    Create
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIsCreatingFolder(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Calls List */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1.5">
                {mounted && filteredCalls.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No calls match your filters</p>
                  </div>
                )}
                {mounted &&
                  visibleCalls.map((call) => (
                    <CallCard
                      key={call.id}
                      call={call}
                      selected={selectedCalls.has(call.id)}
                      onSelect={(selected) => handleSelect(call.id, selected)}
                      onClick={() => setSelectedCall(call)}
                      onQuickAction={(action) => handleQuickAction(call.id, action)}
                      onActionFeedback={(actionId, feedback) => updateActionFeedback(call.id, actionId, feedback)}
                      onDragStart={() => setDraggingCallId(call.id)}
                      onDragEnd={() => setDraggingCallId(null)}
                      isDragging={draggingCallId === call.id}
                    />
                  ))}
                {/* Infinite scroll trigger */}
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
        </div>

        {/* Call Detail Modal */}
        <CallDetailModal
          call={selectedCall}
          open={!!selectedCall}
          onClose={() => setSelectedCall(null)}
          onAction={(action) => {
            if (selectedCall) {
              handleQuickAction(selectedCall.id, action);
              if (action === "complete" || action === "archive" || action === "delete") {
                setSelectedCall(null);
              }
            }
          }}
          onActionFeedback={(actionId, feedback) => {
            if (selectedCall) {
              updateActionFeedback(selectedCall.id, actionId, feedback);
            }
          }}
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
      </main>
    </TooltipProvider>
  );
}
