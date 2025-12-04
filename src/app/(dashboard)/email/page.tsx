"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  ConfirmationDialog,
  useBulkActionConfirmation,
} from "@/components/ui/confirmation-dialog";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Mail,
  Bot,
  Paperclip,
  CheckCircle,
  Clock,
  User,
  Eye,
  Plus,
  RefreshCw,
  ExternalLink,
  FileText,
  ArrowRight,
  AlertTriangle,
  DollarSign,
  Calendar,
  Shield,
  Info,
  HelpCircle,
  Inbox,
  Filter,
  Archive,
  Trash2,
  UserPlus,
  MoreHorizontal,
  CheckSquare,
  XSquare,
  ListTodo,
  Loader2,
  Ban,
  ThumbsUp,
  ThumbsDown,
  Settings,
  GripVertical,
  X,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useEmail } from "@/lib/email";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  EmailMessage,
  EmailTask,
  emailCategoryInfo,
} from "@/lib/email/types";

// Types for kanban board
type TaskStatus = string; // Now dynamic - can be any column id

// Known statuses that map to the backend
type KnownStatus = "pending" | "in_progress" | "waiting" | "completed" | "snoozed";
const KNOWN_STATUSES: KnownStatus[] = ["pending", "in_progress", "waiting", "completed", "snoozed"];

// Helper to check if status is a known backend status
function isKnownStatus(status: string): status is KnownStatus {
  return KNOWN_STATUSES.includes(status as KnownStatus);
}

interface KanbanTask {
  id: string;
  emailTask: EmailTask;
  status: TaskStatus;
  selected: boolean;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

// Default columns if none configured
const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "pending", title: "New", color: "bg-blue-500", order: 0 },
  { id: "waiting", title: "Waiting on Client", color: "bg-amber-500", order: 1 },
  { id: "in_progress", title: "In Progress", color: "bg-violet-500", order: 2 },
  { id: "completed", title: "Completed", color: "bg-emerald-500", order: 3 },
];

// Available colors for columns
const COLUMN_COLORS = [
  { id: "bg-blue-500", label: "Blue" },
  { id: "bg-violet-500", label: "Purple" },
  { id: "bg-amber-500", label: "Amber" },
  { id: "bg-emerald-500", label: "Green" },
  { id: "bg-red-500", label: "Red" },
  { id: "bg-pink-500", label: "Pink" },
  { id: "bg-cyan-500", label: "Cyan" },
  { id: "bg-orange-500", label: "Orange" },
  { id: "bg-slate-500", label: "Slate" },
  { id: "bg-indigo-500", label: "Indigo" },
];

// Icon mapping for categories
const categoryIcons: Record<string, React.ReactNode> = {
  document_request: <FileText className="h-3.5 w-3.5" />,
  question: <HelpCircle className="h-3.5 w-3.5" />,
  payment: <DollarSign className="h-3.5 w-3.5" />,
  appointment: <Calendar className="h-3.5 w-3.5" />,
  tax_filing: <FileText className="h-3.5 w-3.5" />,
  compliance: <Shield className="h-3.5 w-3.5" />,
  follow_up: <Clock className="h-3.5 w-3.5" />,
  information: <Info className="h-3.5 w-3.5" />,
  urgent: <AlertTriangle className="h-3.5 w-3.5" />,
  spam: <Mail className="h-3.5 w-3.5" />,
  internal: <User className="h-3.5 w-3.5" />,
  other: <Mail className="h-3.5 w-3.5" />,
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

// Sortable Task Card Component - entire card is draggable
function SortableTaskCard({
  task,
  cardWidth,
  onClick,
  onSelect,
  onQuickAction,
}: {
  task: KanbanTask;
  cardWidth: number;
  onClick: () => void;
  onSelect: (selected: boolean) => void;
  onQuickAction: (action: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms ease",
    opacity: isDragging ? 0.5 : 1,
    width: cardWidth,
    maxWidth: cardWidth,
  };

  const email = task.emailTask.email;
  const classification = email.aiClassification;
  const priority = classification?.priority || "medium";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all overflow-hidden box-border",
        isDragging && "shadow-xl ring-2 ring-primary/50",
        task.selected && "ring-2 ring-primary bg-primary/5"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2 overflow-hidden">
        {/* Checkbox for selection */}
        <div
          className="mt-0.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={task.selected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            className="h-4 w-4"
          />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden" onClick={onClick}>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", priorityColors[priority])}
            >
              {priority}
            </Badge>
            {classification?.category && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 flex-shrink-0",
                  emailCategoryInfo[classification.category]?.color
                )}
              >
                {categoryIcons[classification.category]}
              </Badge>
            )}
          </div>
          <h4 className="font-medium text-sm truncate max-w-full">
            {email.matchedClientName || email.from.name || email.from.email}
          </h4>
          <p className="text-xs text-muted-foreground truncate max-w-full">
            {email.subject}
          </p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {classification?.summary || email.bodyPreview}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{task.emailTask.assignedToName || "Unassigned"}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Clock className="h-3 w-3" />
              <span suppressHydrationWarning>
                {formatDistanceToNow(email.receivedAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
        {/* Quick actions dropdown */}
        <div
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onQuickAction("view")}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickAction("assign")}>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign To...
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickAction("add_to_tasks")}>
                <ListTodo className="h-4 w-4 mr-2" />
                Add to Tasks
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
    </div>
  );
}

// Task Card for Drag Overlay
function TaskCardOverlay({ task }: { task: KanbanTask }) {
  const email = task.emailTask.email;
  const priority = email.aiClassification?.priority || "medium";

  return (
    <div className="bg-card border rounded-lg p-3 shadow-2xl w-[180px] rotate-3 ring-2 ring-primary">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 mb-1", priorityColors[priority])}
          >
            {priority}
          </Badge>
          <h4 className="font-medium text-sm truncate">
            {email.matchedClientName || email.from.name}
          </h4>
          <p className="text-xs text-muted-foreground truncate">
            {email.subject}
          </p>
        </div>
      </div>
    </div>
  );
}

// Droppable Kanban Column Component
function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onTaskSelect,
  onQuickAction,
}: {
  column: KanbanColumn;
  tasks: KanbanTask[];
  onTaskClick: (task: KanbanTask) => void;
  onTaskSelect: (taskId: string, selected: boolean) => void;
  onQuickAction: (taskId: string, action: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  // Calculate available width for cards (column width minus padding)
  const cardWidth = 234; // 250px column - 16px padding

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[250px] flex-shrink-0 rounded-lg transition-colors",
        isOver && "bg-primary/10"
      )}
      style={{ minWidth: 250, maxWidth: 250 }}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={cn("w-2 h-2 rounded-full", column.color)} />
        <h3 className="font-medium text-sm">{column.title}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {tasks.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 pb-4 min-h-[100px] px-1">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                cardWidth={cardWidth}
                onClick={() => onTaskClick(task)}
                onSelect={(selected) => onTaskSelect(task.id, selected)}
                onQuickAction={(action) => onQuickAction(task.id, action)}
              />
            ))}
            {tasks.length === 0 && (
              <div
                className={cn(
                  "text-center py-8 text-muted-foreground text-xs border-2 border-dashed rounded-lg transition-colors",
                  isOver && "border-primary bg-primary/5"
                )}
              >
                Drop tasks here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// Email Timeline Card
function EmailTimelineCard({
  email,
  onCreateTask,
  onViewEmail,
  hasTask,
  onReject,
  showRejectButton = true,
  isSelected = false,
  onSelect,
}: {
  email: EmailMessage;
  onCreateTask: () => void;
  onViewEmail: () => void;
  hasTask: boolean;
  onReject?: () => void;
  showRejectButton?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}) {
  const classification = email.aiClassification;
  const category = classification?.category || "other";
  const categoryInfo = emailCategoryInfo[category];

  return (
    <Card
      className={cn(
        "p-4 transition-all hover:shadow-md",
        !email.isRead && "border-l-4 border-l-primary",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {onSelect && (
          <div className="flex-shrink-0 pt-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(checked === true)}
              className="h-4 w-4"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback
            className={cn(
              !email.isRead ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {(email.from.name || email.from.email)
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "font-medium text-sm",
                !email.isRead && "font-semibold"
              )}
            >
              {email.from.name || email.from.email}
            </span>
            <span
              className="text-xs text-muted-foreground"
              suppressHydrationWarning
            >
              {formatDistanceToNow(email.receivedAt, { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{email.from.email}</p>
          {email.matchedClientName && (
            <Badge variant="outline" className="text-[10px] mt-1">
              <User className="h-3 w-3 mr-1" />
              {email.matchedClientName}
            </Badge>
          )}
        </div>
      </div>

      {/* Account indicator */}
      <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
        <Inbox className="h-3 w-3" />
        <span>{email.accountEmail}</span>
      </div>

      {/* Subject */}
      <h4 className={cn("font-medium mb-2", !email.isRead && "font-semibold")}>
        {email.subject}
      </h4>

      {/* AI Analysis Box */}
      {classification && (
        <div className="bg-primary/5 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">AI Analysis</span>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0 ml-auto", categoryInfo?.color)}
            >
              {categoryIcons[category]}
              <span className="ml-1">{categoryInfo?.label}</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{classification.summary}</p>
          {classification.keyPoints && classification.keyPoints.length > 0 && (
            <div className="mt-2 pt-2 border-t border-primary/10">
              <p className="text-xs font-medium mb-1">Key Points:</p>
              <ul className="space-y-0.5">
                {classification.keyPoints.slice(0, 3).map((point, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-muted-foreground flex items-center gap-1.5"
                  >
                    <ArrowRight className="h-3 w-3 text-primary" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {classification.suggestedAction && (
            <div className="mt-2 pt-2 border-t border-primary/10">
              <p className="text-xs">
                <span className="font-medium">Suggested: </span>
                <span className="text-muted-foreground capitalize">
                  {classification.suggestedAction.replace(/_/g, " ")}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Attachments */}
      {email.hasAttachments && email.attachments && email.attachments.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          <span>
            {email.attachments.length} attachment
            {email.attachments.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onViewEmail}
        >
          <Eye className="h-4 w-4 mr-1.5" />
          View Email
        </Button>
        {!hasTask && (
          <Button size="sm" className="flex-1 bg-primary" onClick={onCreateTask}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Task
          </Button>
        )}
        {hasTask && (
          <Button variant="secondary" size="sm" className="flex-1" disabled>
            <CheckCircle className="h-4 w-4 mr-1.5" />
            Task Created
          </Button>
        )}
        {showRejectButton && onReject && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onReject}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Not relevant - move to rejected</TooltipContent>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}

// Rejected Email Card - simplified version with approve action
function RejectedEmailCard({
  email,
  onViewEmail,
  onApprove,
  isSelected = false,
  onSelect,
}: {
  email: EmailMessage;
  onViewEmail: () => void;
  onApprove: () => void;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}) {
  const classification = email.aiClassification;
  const category = classification?.category || "spam";

  return (
    <Card className={cn(
      "p-4 transition-all hover:shadow-md border-l-4 border-l-muted-foreground/30",
      isSelected && "ring-2 ring-primary bg-primary/5"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {onSelect && (
          <div className="flex-shrink-0 pt-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(checked === true)}
              className="h-4 w-4"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="bg-muted">
            {(email.from.name || email.from.email)
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm text-muted-foreground">
              {email.from.name || email.from.email}
            </span>
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
              {formatDistanceToNow(email.receivedAt, { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{email.from.email}</p>
        </div>
      </div>

      {/* Subject */}
      <h4 className="font-medium mb-2 text-muted-foreground">{email.subject}</h4>

      {/* Rejection Reason */}
      <div className="bg-muted/50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Ban className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filtered Out</span>
          <Badge variant="outline" className="text-[10px] ml-auto bg-muted">
            {category === "spam" ? "Spam" : category === "information" ? "Marketing/Newsletter" : emailCategoryInfo[category]?.label || "Not Relevant"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {classification?.summary || "This email was automatically filtered as not business-relevant."}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onViewEmail}
        >
          <Eye className="h-4 w-4 mr-1.5" />
          View
        </Button>
        <Button
          size="sm"
          className="flex-1"
          variant="secondary"
          onClick={onApprove}
        >
          <ThumbsUp className="h-4 w-4 mr-1.5" />
          Mark Relevant
        </Button>
      </div>
    </Card>
  );
}

export default function EmailPage() {
  const [mounted, setMounted] = useState(false);
  const { isAdmin } = useAuth();
  const {
    accounts,
    emails,
    rejectedEmails,
    emailTasks,
    getUnreadCount,
    getRejectedCount,
    syncAllAccounts,
    updateTaskStatus,
    isSyncing,
    markAsRelevant,
    markAsRejected,
    undoLastAction,
    addSenderRule,
    markMultipleAsRelevant,
    markMultipleAsRejected,
  } = useEmail();

  // Kanban column configuration state
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [editingColumns, setEditingColumns] = useState<KanbanColumn[]>([]);
  const [isSavingColumns, setIsSavingColumns] = useState(false);

  // Sent email training state
  const [isTraining, setIsTraining] = useState(false);

  // Train filter from sent emails
  const handleTrainFromSent = useCallback(async () => {
    setIsTraining(true);
    try {
      const res = await fetch("/api/email/train-from-sent", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Training complete!`, {
          description: `Whitelisted ${data.stats.newDomainsWhitelisted} new domains from ${data.stats.totalRecipientsFound} sent email recipients`,
          duration: 8000,
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "Training failed");
      }
    } catch (error) {
      console.error("Training error:", error);
      toast.error("Failed to train from sent emails");
    }
    setIsTraining(false);
  }, []);

  // Load column configuration on mount
  useEffect(() => {
    const loadColumns = async () => {
      try {
        const res = await fetch("/api/email/kanban-columns");
        if (res.ok) {
          const data = await res.json();
          if (data.columns && data.columns.length > 0) {
            // Sort by order
            const sortedColumns = [...data.columns].sort((a, b) => a.order - b.order);
            setColumns(sortedColumns);
          }
        }
      } catch (error) {
        console.error("Failed to load column configuration:", error);
      }
    };
    loadColumns();
  }, []);

  // Save column configuration
  const saveColumns = useCallback(async (newColumns: KanbanColumn[]) => {
    setIsSavingColumns(true);
    try {
      // Ensure columns have correct order values
      const columnsWithOrder = newColumns.map((col, idx) => ({
        ...col,
        order: idx,
      }));

      const res = await fetch("/api/email/kanban-columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: columnsWithOrder }),
      });
      if (res.ok) {
        // Sort columns by order
        const sortedColumns = [...columnsWithOrder].sort((a, b) => a.order - b.order);

        // Get the IDs of new columns
        const newColumnIds = new Set(sortedColumns.map((c) => c.id));
        const firstColumnId = sortedColumns[0]?.id;

        // Reassign any tasks in deleted columns to the first column
        if (firstColumnId) {
          setKanbanTasks((prev) =>
            prev.map((task) => {
              if (!newColumnIds.has(task.status)) {
                // Task is in a deleted column, move to first column
                return { ...task, status: firstColumnId };
              }
              return task;
            })
          );
        }

        setColumns(sortedColumns);
        setEditingColumns(sortedColumns);
        toast.success("Column settings saved");
        setShowColumnSettings(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save columns");
      }
    } catch (error) {
      console.error("Failed to save columns:", error);
      toast.error("Failed to save columns");
    }
    setIsSavingColumns(false);
  }, []);

  // Reset to default columns
  const resetColumns = useCallback(async () => {
    setIsSavingColumns(true);
    try {
      const res = await fetch("/api/email/kanban-columns", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        // Sort columns by order
        const sortedColumns = [...data.columns].sort((a: KanbanColumn, b: KanbanColumn) => a.order - b.order);
        setColumns(sortedColumns);
        setEditingColumns(sortedColumns);
        toast.success("Columns reset to defaults");
      }
    } catch (error) {
      console.error("Failed to reset columns:", error);
      toast.error("Failed to reset columns");
    }
    setIsSavingColumns(false);
  }, []);

  // Open settings modal
  const openColumnSettings = useCallback(() => {
    setEditingColumns([...columns]);
    setShowColumnSettings(true);
  }, [columns]);

  // Add new column
  const addColumn = useCallback(() => {
    const newId = `col_${Date.now()}`;
    const newColumn: KanbanColumn = {
      id: newId,
      title: "New Column",
      color: "bg-slate-500",
      order: editingColumns.length,
    };
    setEditingColumns([...editingColumns, newColumn]);
  }, [editingColumns]);

  // Remove column
  const removeColumn = useCallback((columnId: string) => {
    setEditingColumns((prev) =>
      prev.filter((c) => c.id !== columnId).map((c, idx) => ({ ...c, order: idx }))
    );
  }, []);

  // Update column
  const updateColumn = useCallback((columnId: string, updates: Partial<KanbanColumn>) => {
    setEditingColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, ...updates } : c))
    );
  }, []);

  // Move column up/down
  const moveColumn = useCallback((columnId: string, direction: "up" | "down") => {
    setEditingColumns((prev) => {
      const idx = prev.findIndex((c) => c.id === columnId);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;

      const newColumns = [...prev];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      [newColumns[idx], newColumns[targetIdx]] = [newColumns[targetIdx], newColumns[idx]];
      return newColumns.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  // Bulk email selection state
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());

  // Handle marking email as relevant with toast
  const handleMarkRelevant = useCallback((emailId: string, email: EmailMessage) => {
    markAsRelevant(emailId);
    toast.success("Email moved to inbox", {
      description: `"${email.subject?.slice(0, 40)}${email.subject && email.subject.length > 40 ? "..." : ""}"`,
      action: {
        label: "Undo",
        onClick: () => undoLastAction(),
      },
      duration: 5000,
    });
  }, [markAsRelevant, undoLastAction]);

  // Handle marking email as rejected with toast
  const handleMarkRejected = useCallback((emailId: string, email: EmailMessage) => {
    markAsRejected(emailId);
    toast.success("Email moved to filtered", {
      description: `"${email.subject?.slice(0, 40)}${email.subject && email.subject.length > 40 ? "..." : ""}"`,
      action: {
        label: "Undo",
        onClick: () => undoLastAction(),
      },
      duration: 5000,
    });
  }, [markAsRejected, undoLastAction]);

  // Handle adding sender to whitelist
  const handleWhitelistSender = useCallback(async (email: EmailMessage) => {
    const domain = email.from.email.split("@")[1];
    await addSenderRule({
      ruleType: "domain",
      matchType: "exact",
      matchValue: domain,
      action: "whitelist",
      reason: `Whitelisted from email: ${email.subject}`,
      isActive: true,
    });
    toast.success(`Whitelisted @${domain}`, {
      description: "Future emails from this domain will always be relevant",
    });
  }, [addSenderRule]);

  // Handle adding sender to blacklist
  const handleBlacklistSender = useCallback(async (email: EmailMessage) => {
    const domain = email.from.email.split("@")[1];
    await addSenderRule({
      ruleType: "domain",
      matchType: "exact",
      matchValue: domain,
      action: "blacklist",
      reason: `Blacklisted from email: ${email.subject}`,
      isActive: true,
    });
    toast.success(`Blacklisted @${domain}`, {
      description: "Future emails from this domain will always be filtered",
    });
  }, [addSenderRule]);

  // Email selection handlers
  const handleEmailSelect = useCallback((emailId: string, selected: boolean) => {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(emailId);
      } else {
        next.delete(emailId);
      }
      return next;
    });
  }, []);

  // This will be defined later, using a ref pattern to avoid circular deps
  const handleSelectAllEmails = useCallback((emailsToSelect: EmailMessage[]) => {
    setSelectedEmailIds(new Set(emailsToSelect.map((e) => e.id)));
  }, []);

  const handleDeselectAllEmails = useCallback(() => {
    setSelectedEmailIds(new Set());
  }, []);

  // Bulk actions for emails
  const handleBulkMarkRelevant = useCallback(() => {
    const ids = Array.from(selectedEmailIds);
    markMultipleAsRelevant(ids);
    toast.success(`${ids.length} email${ids.length !== 1 ? "s" : ""} moved to inbox`, {
      description: "Training feedback saved",
    });
    setSelectedEmailIds(new Set());
  }, [selectedEmailIds, markMultipleAsRelevant]);

  const handleBulkMarkRejected = useCallback(() => {
    const ids = Array.from(selectedEmailIds);
    markMultipleAsRejected(ids);
    toast.success(`${ids.length} email${ids.length !== 1 ? "s" : ""} moved to filtered`, {
      description: "Training feedback saved",
    });
    setSelectedEmailIds(new Set());
  }, [selectedEmailIds, markMultipleAsRejected]);

  const selectedEmailCount = selectedEmailIds.size;

  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>([]);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [feedTab, setFeedTab] = useState<"relevant" | "rejected">("relevant");

  // Infinite scroll state for email feed
  const EMAILS_PER_PAGE = 10;
  const [visibleEmailCount, setVisibleEmailCount] = useState(EMAILS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const emailScrollContainerRef = useRef<HTMLDivElement>(null);

  // Confirmation dialog for bulk actions
  const { confirmBulkAction, state: bulkState, setOpen: setBulkOpen } = useBulkActionConfirmation();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Convert emailTasks to kanban tasks
  useEffect(() => {
    const tasks = emailTasks.map((et) => ({
      id: et.id,
      emailTask: et,
      status: (et.status === "snoozed" ? "waiting" : et.status) as TaskStatus,
      selected: false,
    }));
    setKanbanTasks(tasks);
  }, [emailTasks]);

  // Sensors with lower activation distance for smoother dragging
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter emails based on category, account, and feed tab
  const filteredEmails = useMemo(() => {
    // Use the appropriate email list based on the tab
    let result = feedTab === "relevant" ? emails : rejectedEmails;

    if (accountFilter !== "all") {
      result = result.filter((e) => e.accountId === accountFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter(
        (e) => e.aiClassification?.category === categoryFilter
      );
    }

    // Sort by receivedAt descending
    return [...result].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }, [emails, rejectedEmails, categoryFilter, accountFilter, feedTab]);

  // Visible emails for infinite scroll (slice of filtered emails)
  const visibleEmails = useMemo(() => {
    return filteredEmails.slice(0, visibleEmailCount);
  }, [filteredEmails, visibleEmailCount]);

  const hasMoreEmails = visibleEmailCount < filteredEmails.length;

  // Reset visible count and clear selections when filters change
  useEffect(() => {
    setVisibleEmailCount(EMAILS_PER_PAGE);
    setSelectedEmailIds(new Set());
  }, [categoryFilter, accountFilter, feedTab]);

  // Load more emails function
  const loadMoreEmails = useCallback(() => {
    if (isLoadingMore || !hasMoreEmails) return;

    setIsLoadingMore(true);
    // Simulate network delay for smooth UX
    setTimeout(() => {
      setVisibleEmailCount((prev) => prev + EMAILS_PER_PAGE);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMoreEmails]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreEmails && !isLoadingMore) {
          loadMoreEmails();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMoreEmails, isLoadingMore, loadMoreEmails]);

  // Get task IDs for quick lookup
  const taskEmailIds = useMemo(() => {
    return new Set(emailTasks.map((t) => t.emailId));
  }, [emailTasks]);

  const tasksByStatus = useMemo(() => {
    // Initialize with all column IDs from dynamic columns
    const grouped: Record<TaskStatus, KanbanTask[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = [];
    });

    kanbanTasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        // If task has unknown status, put in first column
        if (columns.length > 0) {
          grouped[columns[0].id].push(task);
        }
      }
    });
    return grouped;
  }, [kanbanTasks, columns]);

  // Selected tasks count
  const selectedCount = useMemo(
    () => kanbanTasks.filter((t) => t.selected).length,
    [kanbanTasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = kanbanTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskData = kanbanTasks.find((t) => t.id === active.id);
    if (!activeTaskData) return;

    // Helper to update backend status (only for known statuses)
    const updateBackendStatus = (taskId: string, newStatus: string) => {
      // Map "waiting" to "snoozed" for backend
      const backendStatus = newStatus === "waiting" ? "snoozed" : newStatus;
      if (isKnownStatus(backendStatus)) {
        updateTaskStatus(taskId, backendStatus);
      }
      // For custom columns, we only update local state (handled by setKanbanTasks)
    };

    // Check if dropping over a column
    const targetColumn = columns.find((c) => c.id === over.id);
    if (targetColumn && activeTaskData.status !== targetColumn.id) {
      setKanbanTasks((prev) =>
        prev.map((t) =>
          t.id === active.id ? { ...t, status: targetColumn.id } : t
        )
      );
      updateBackendStatus(activeTaskData.id, targetColumn.id);
      return;
    }

    // Check if dropping over another task
    const overTask = kanbanTasks.find((t) => t.id === over.id);
    if (overTask) {
      if (activeTaskData.status !== overTask.status) {
        // Move to different column
        setKanbanTasks((prev) =>
          prev.map((t) =>
            t.id === active.id ? { ...t, status: overTask.status } : t
          )
        );
        updateBackendStatus(activeTaskData.id, overTask.status);
      } else if (active.id !== over.id) {
        // Reorder within same column
        const oldIndex = kanbanTasks.findIndex((t) => t.id === active.id);
        const newIndex = kanbanTasks.findIndex((t) => t.id === over.id);
        setKanbanTasks(arrayMove(kanbanTasks, oldIndex, newIndex));
      }
    }
  };

  const handleRefresh = useCallback(async () => {
    await syncAllAccounts();
  }, [syncAllAccounts]);

  // Task selection handlers
  const handleTaskSelect = useCallback((taskId: string, selected: boolean) => {
    setKanbanTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, selected } : t))
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setKanbanTasks((prev) => prev.map((t) => ({ ...t, selected: true })));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setKanbanTasks((prev) => prev.map((t) => ({ ...t, selected: false })));
  }, []);

  // Quick action handler
  const handleQuickAction = useCallback(
    (taskId: string, action: string) => {
      const task = kanbanTasks.find((t) => t.id === taskId);
      if (!task) return;

      switch (action) {
        case "view":
          setSelectedTask(task);
          break;
        case "archive":
          setKanbanTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: "completed" as TaskStatus } : t
            )
          );
          updateTaskStatus(taskId, "completed");
          break;
        case "delete":
          setKanbanTasks((prev) => prev.filter((t) => t.id !== taskId));
          break;
        case "assign":
          // Would open assign dialog
          break;
        case "add_to_tasks":
          // Would add to main tasks
          break;
      }
    },
    [kanbanTasks, updateTaskStatus]
  );

  // Bulk action handler with confirmation for destructive actions
  const handleBulkAction = useCallback(
    async (action: string) => {
      const selectedTaskIds = kanbanTasks.filter((t) => t.selected).map((t) => t.id);
      const count = selectedTaskIds.length;

      // Actions requiring confirmation
      if (action === "delete" || action === "archive") {
        await confirmBulkAction({
          action: action as "delete" | "archive",
          itemCount: count,
          itemName: "email task",
          onConfirm: () => {
            if (action === "archive") {
              setKanbanTasks((prev) =>
                prev.map((t) =>
                  t.selected ? { ...t, status: "completed" as TaskStatus, selected: false } : t
                )
              );
              selectedTaskIds.forEach((id) => updateTaskStatus(id, "completed"));
            } else if (action === "delete") {
              setKanbanTasks((prev) => prev.filter((t) => !t.selected));
            }
          },
        });
        return;
      }

      // Non-destructive actions execute immediately
      switch (action) {
        case "mark_in_progress":
          setKanbanTasks((prev) =>
            prev.map((t) =>
              t.selected ? { ...t, status: "in_progress" as TaskStatus, selected: false } : t
            )
          );
          selectedTaskIds.forEach((id) => updateTaskStatus(id, "in_progress"));
          break;
        case "mark_waiting":
          setKanbanTasks((prev) =>
            prev.map((t) =>
              t.selected ? { ...t, status: "waiting" as TaskStatus, selected: false } : t
            )
          );
          selectedTaskIds.forEach((id) => updateTaskStatus(id, "snoozed"));
          break;
      }
    },
    [kanbanTasks, updateTaskStatus, confirmBulkAction]
  );

  // Check if there are any connected accounts
  const hasConnectedAccounts = accounts.length > 0;
  const hasConnectedAndActive = accounts.some((a) => a.isConnected);

  if (!hasConnectedAccounts || !hasConnectedAndActive) {
    return (
      <>
        <Header title="AI Email Tasks" />
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full p-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Connect Your Email</h2>
              <p className="text-muted-foreground text-sm">
                Connect your Microsoft 365 or Outlook account in System Settings
                to enable AI-powered email processing.
              </p>
              <Button className="bg-primary mt-2" asChild>
                <a href="/admin/system">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to System Settings
                </a>
              </Button>
            </div>
          </Card>
        </main>
      </>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Header title="AI Email Tasks" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-medium">AI Email Tasks</span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 ml-4">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs" aria-label="Filter by email account">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px] h-8 text-xs" aria-label="Filter by email category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(emailCategoryInfo).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          {/* Bulk Actions - shown when items are selected */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">{selectedCount} selected</span>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Mark selected tasks as in progress"
                      onClick={() => handleBulkAction("mark_in_progress")}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark In Progress</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Archive selected tasks"
                      onClick={() => handleBulkAction("archive")}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Archive</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      aria-label="Delete selected tasks"
                      onClick={() => handleBulkAction("delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 ml-1"
                  onClick={handleDeselectAll}
                >
                  <XSquare className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <Inbox className="h-3 w-3" />
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </Badge>
            <span>{getUnreadCount()} unread</span>
            <span className="text-border">|</span>
            <span>{emailTasks.length} tasks</span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Select all tasks"
                onClick={handleSelectAll}
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Select All</TooltipContent>
          </Tooltip>

          {/* Train from sent emails - admin only */}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleTrainFromSent}
                  disabled={isTraining}
                >
                  {isTraining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isTraining ? "Training..." : "Train Filter"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Whitelist domains from your sent emails
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={isSyncing ? "Syncing emails" : "Refresh emails"}
                onClick={handleRefresh}
                disabled={isSyncing}
              >
                <RefreshCw
                  className={cn("h-4 w-4", isSyncing && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isSyncing ? "Syncing..." : "Refresh emails"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Email Timeline */}
          <div className="w-[420px] flex-shrink-0 border-r flex flex-col bg-muted/30">
            <div className="p-3 border-b bg-card">
              {/* Feed Tabs */}
              <div className="flex items-center gap-1 mb-2">
                <Button
                  variant={feedTab === "relevant" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs",
                    feedTab === "relevant" && "bg-primary"
                  )}
                  onClick={() => setFeedTab("relevant")}
                >
                  <Inbox className="h-3.5 w-3.5 mr-1.5" />
                  Inbox
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    {emails.length}
                  </Badge>
                </Button>
                <Button
                  variant={feedTab === "rejected" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs",
                    feedTab === "rejected" && "bg-muted-foreground"
                  )}
                  onClick={() => setFeedTab("rejected")}
                >
                  <Ban className="h-3.5 w-3.5 mr-1.5" />
                  Filtered
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    {getRejectedCount()}
                  </Badge>
                </Button>
                <div className="ml-auto">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleSelectAllEmails(filteredEmails)}
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Select all</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Bulk Selection Toolbar */}
              {selectedEmailCount > 0 ? (
                <div className="flex items-center gap-2 py-1 px-2 bg-primary/10 rounded-lg">
                  <span className="text-xs font-medium">{selectedEmailCount} selected</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {feedTab === "rejected" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleBulkMarkRelevant}
                          >
                            <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                            Mark Relevant
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move selected to inbox</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleBulkMarkRejected}
                          >
                            <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                            Filter Out
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move selected to filtered</TooltipContent>
                      </Tooltip>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleDeselectAllEmails}
                    >
                      <XSquare className="h-3.5 w-3.5 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {feedTab === "relevant"
                    ? `Business-relevant emails from ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`
                    : "Spam, marketing, newsletters & non-relevant emails"}
                </p>
              )}
            </div>
            <div
              ref={emailScrollContainerRef}
              className="flex-1 overflow-y-auto"
            >
              <div className="p-3 space-y-3">
                {mounted && filteredEmails.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    {feedTab === "relevant" ? (
                      <>
                        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No emails match your filters</p>
                      </>
                    ) : (
                      <>
                        <Ban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No filtered emails</p>
                        <p className="text-xs mt-1">All your emails are business-relevant!</p>
                      </>
                    )}
                  </div>
                )}
                {mounted && feedTab === "relevant" &&
                  visibleEmails.map((email) => (
                    <EmailTimelineCard
                      key={email.id}
                      email={email}
                      hasTask={taskEmailIds.has(email.id)}
                      onCreateTask={() => {
                        // Task is auto-created by the context for emails that need response
                      }}
                      onViewEmail={() => setSelectedEmail(email)}
                      onReject={() => handleMarkRejected(email.id, email)}
                      showRejectButton={true}
                      isSelected={selectedEmailIds.has(email.id)}
                      onSelect={(selected) => handleEmailSelect(email.id, selected)}
                    />
                  ))}
                {mounted && feedTab === "rejected" &&
                  visibleEmails.map((email) => (
                    <RejectedEmailCard
                      key={email.id}
                      email={email}
                      onViewEmail={() => setSelectedEmail(email)}
                      onApprove={() => handleMarkRelevant(email.id, email)}
                      isSelected={selectedEmailIds.has(email.id)}
                      onSelect={(selected) => handleEmailSelect(email.id, selected)}
                    />
                  ))}

                {/* Infinite scroll trigger */}
                {mounted && hasMoreEmails && (
                  <div
                    ref={loadMoreRef}
                    className="flex items-center justify-center py-4"
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading more emails...</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Scroll for more ({filteredEmails.length - visibleEmailCount} remaining)
                      </span>
                    )}
                  </div>
                )}

                {/* End of list indicator */}
                {mounted && !hasMoreEmails && filteredEmails.length > EMAILS_PER_PAGE && (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    All {filteredEmails.length} emails loaded
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Kanban Board */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <div className="p-3 border-b bg-card flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Task Board
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Drag cards anywhere to move between columns
                  </p>
                </div>
                {isAdmin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={openColumnSettings}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Customize columns</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="inline-flex gap-4 h-full min-w-max pb-4">
                  {columns.map((column) => (
                    <KanbanColumn
                      key={column.id}
                      column={column}
                      tasks={tasksByStatus[column.id] || []}
                      onTaskClick={setSelectedTask}
                      onTaskSelect={handleTaskSelect}
                      onQuickAction={handleQuickAction}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                  {activeTask && <TaskCardOverlay task={activeTask} />}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        </div>

        {/* Email Detail Modal */}
        {mounted && (
          <Dialog
            open={!!selectedEmail}
            onOpenChange={() => setSelectedEmail(null)}
          >
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{selectedEmail?.subject}</DialogTitle>
              </DialogHeader>
              {selectedEmail && (
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="space-y-4 pr-4 pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {(selectedEmail.from.name || selectedEmail.from.email)
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {selectedEmail.from.name || selectedEmail.from.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedEmail.from.email}
                        </p>
                      </div>
                      <p
                        className="text-sm text-muted-foreground ml-auto"
                        suppressHydrationWarning
                      >
                        {format(selectedEmail.receivedAt, "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>

                    {/* Account info */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Inbox className="h-4 w-4" />
                      <span>Received at: {selectedEmail.accountEmail}</span>
                    </div>

                    {/* AI Classification */}
                    {selectedEmail.aiClassification && (
                      <div className="bg-primary/5 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            AI Analysis
                          </span>
                          <Badge
                            className={cn(
                              "ml-auto",
                              priorityColors[selectedEmail.aiClassification.priority]
                            )}
                          >
                            {selectedEmail.aiClassification.priority}
                          </Badge>
                        </div>
                        <p className="text-sm">
                          {selectedEmail.aiClassification.summary}
                        </p>
                        {selectedEmail.aiClassification.keyPoints.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {selectedEmail.aiClassification.keyPoints.map(
                              (point, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-muted-foreground flex items-center gap-2"
                                >
                                  <ArrowRight className="h-3 w-3 text-primary" />
                                  {point}
                                </li>
                              )
                            )}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Email Body */}
                    {selectedEmail.bodyType === "html" ? (
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <iframe
                          srcDoc={selectedEmail.body}
                          className="w-full min-h-[300px] border-0"
                          sandbox="allow-same-origin"
                          title="Email content"
                          onLoad={(e) => {
                            // Auto-resize iframe to content height
                            const iframe = e.target as HTMLIFrameElement;
                            if (iframe.contentDocument) {
                              const height = iframe.contentDocument.body.scrollHeight;
                              iframe.style.height = `${Math.min(height + 20, 500)}px`;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm bg-transparent border-0 p-0">
                          {selectedEmail.body}
                        </pre>
                      </div>
                    )}
                    {selectedEmail.attachments &&
                      selectedEmail.attachments.length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            Attachments
                          </h4>
                          <div className="space-y-2">
                            {selectedEmail.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                              >
                                <FileText className="h-4 w-4 text-primary" />
                                <span className="text-sm">{att.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(att.size / 1024)} KB
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
              <DialogFooter className="flex-shrink-0 flex-wrap gap-2">
                <div className="flex gap-2 mr-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Shield className="h-4 w-4 mr-1.5" />
                        Sender Rules
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => selectedEmail && handleWhitelistSender(selectedEmail)}
                      >
                        <ThumbsUp className="h-4 w-4 mr-2 text-green-600" />
                        Always allow @{selectedEmail?.from.email.split("@")[1]}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => selectedEmail && handleBlacklistSender(selectedEmail)}
                      >
                        <Ban className="h-4 w-4 mr-2 text-red-600" />
                        Always filter @{selectedEmail?.from.email.split("@")[1]}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button variant="outline" onClick={() => setSelectedEmail(null)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Task Detail Modal */}
        {mounted && (
          <Dialog
            open={!!selectedTask}
            onOpenChange={() => setSelectedTask(null)}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedTask?.emailTask.email.aiClassification && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        priorityColors[
                          selectedTask.emailTask.email.aiClassification.priority
                        ]
                      )}
                    >
                      {selectedTask.emailTask.email.aiClassification.priority}
                    </Badge>
                  )}
                  {selectedTask?.emailTask.email.subject}
                </DialogTitle>
              </DialogHeader>
              {selectedTask && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">From</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTask.emailTask.email.matchedClientName ||
                        selectedTask.emailTask.email.from.name}{" "}
                      ({selectedTask.emailTask.email.from.email})
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">AI Summary</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTask.emailTask.email.aiClassification?.summary ||
                        selectedTask.emailTask.email.bodyPreview}
                    </p>
                  </div>
                  {selectedTask.emailTask.email.aiClassification?.keyPoints && (
                    <div>
                      <p className="text-sm font-medium mb-2">Key Points</p>
                      <ul className="space-y-1">
                        {selectedTask.emailTask.email.aiClassification.keyPoints.map(
                          (item, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <ArrowRight className="h-3 w-3 text-primary" />
                              {item}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Assigned to: </span>
                      <span className="font-medium">
                        {selectedTask.emailTask.assignedToName || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status: </span>
                      <Badge variant="outline" className="capitalize">
                        {selectedTask.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>

                  {/* Quick Actions in Modal */}
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Quick Actions</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleQuickAction(selectedTask.id, "archive");
                          setSelectedTask(null);
                        }}
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        Archive
                      </Button>
                      <Button variant="outline" size="sm">
                        <UserPlus className="h-4 w-4 mr-1" />
                        Assign
                      </Button>
                      <Button variant="outline" size="sm">
                        <ListTodo className="h-4 w-4 mr-1" />
                        Add to Tasks
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          handleQuickAction(selectedTask.id, "delete");
                          setSelectedTask(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTask(null)}>
                  Close
                </Button>
                <Button
                  className="bg-primary"
                  onClick={() => {
                    if (selectedTask) {
                      setSelectedEmail(selectedTask.emailTask.email);
                      setSelectedTask(null);
                    }
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  View Source Email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Column Settings Modal */}
        {mounted && (
          <Dialog
            open={showColumnSettings}
            onOpenChange={(open) => {
              if (!open) setShowColumnSettings(false);
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Customize Kanban Columns
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  Add, remove, rename, or reorder columns. Changes are saved for all users.
                </p>

                {/* Column List */}
                <div className="space-y-2">
                  {editingColumns.map((col, idx) => (
                    <div
                      key={col.id}
                      className="flex items-center gap-2 p-2 border rounded-lg bg-card"
                    >
                      {/* Drag handle indicator */}
                      <div className="text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Color selector */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                          >
                            <div className={cn("w-4 h-4 rounded", col.color)} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <div className="grid grid-cols-5 gap-1 p-2">
                            {COLUMN_COLORS.map((color) => (
                              <button
                                key={color.id}
                                className={cn(
                                  "w-8 h-8 rounded hover:scale-110 transition-transform",
                                  color.id,
                                  col.color === color.id && "ring-2 ring-primary ring-offset-2"
                                )}
                                onClick={() => updateColumn(col.id, { color: color.id })}
                                title={color.label}
                              />
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Column name input */}
                      <Input
                        value={col.title}
                        onChange={(e) => updateColumn(col.id, { title: e.target.value })}
                        className="flex-1 h-8"
                        placeholder="Column name"
                      />

                      {/* Move up/down buttons */}
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-6"
                          onClick={() => moveColumn(col.id, "up")}
                          disabled={idx === 0}
                        >
                          <span className="text-xs">▲</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-6"
                          onClick={() => moveColumn(col.id, "down")}
                          disabled={idx === editingColumns.length - 1}
                        >
                          <span className="text-xs">▼</span>
                        </Button>
                      </div>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeColumn(col.id)}
                        disabled={editingColumns.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Add column button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={addColumn}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Column
                </Button>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetColumns}
                  disabled={isSavingColumns}
                  className="mr-auto"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset to Defaults
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowColumnSettings(false)}
                  disabled={isSavingColumns}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveColumns(editingColumns)}
                  disabled={isSavingColumns || editingColumns.length === 0}
                >
                  {isSavingColumns ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Confirmation Dialogs */}
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
