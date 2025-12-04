"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
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
  Check,
  Clock,
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
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useEmail } from "@/lib/email";
import { useAuth } from "@/lib/supabase/auth-context";
import { EmailMessage, emailCategoryInfo } from "@/lib/email/types";

// Kanban email card type
interface KanbanEmailCard {
  id: string;
  email: EmailMessage;
  columnId: string;
  isRejected: boolean;
  selected: boolean;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

// Default columns
const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "new", title: "New", color: "bg-blue-500", order: 0 },
  { id: "in_progress", title: "In Progress", color: "bg-violet-500", order: 1 },
  { id: "waiting", title: "Waiting on Client", color: "bg-amber-500", order: 2 },
  { id: "completed", title: "Completed", color: "bg-emerald-500", order: 3 },
];

// Column colors
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

// Category icons
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

// Sortable Email Card
function SortableEmailCard({
  card,
  onClick,
  onSelect,
  onQuickAction,
}: {
  card: KanbanEmailCard;
  onClick: () => void;
  onSelect: (selected: boolean) => void;
  onQuickAction: (action: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms ease",
    opacity: isDragging ? 0.5 : 1,
  };

  const email = card.email;
  const classification = email.aiClassification;
  const priority = classification?.priority || "medium";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
        isDragging && "shadow-xl ring-2 ring-primary/50",
        card.selected && "ring-2 ring-primary bg-primary/5",
        card.isRejected && "opacity-75"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={card.selected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            className="h-4 w-4"
          />
        </div>
        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", priorityColors[priority])}
            >
              {priority}
            </Badge>
            {classification?.category && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  emailCategoryInfo[classification.category]?.color
                )}
              >
                {categoryIcons[classification.category]}
              </Badge>
            )}
            {card.isRejected && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted">
                <Ban className="h-3 w-3 mr-0.5" />
                Filtered
              </Badge>
            )}
          </div>

          <h4 className="font-medium text-sm truncate">
            {email.matchedClientName || email.from.name || email.from.email}
          </h4>
          <p className="text-xs text-muted-foreground truncate">{email.subject}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {classification?.summary || email.bodyPreview}
          </p>

          <div className="flex items-center justify-between mt-2 pt-2 border-t gap-2">
            {email.hasAttachments && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                <span>{email.attachments?.length || 1}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <Clock className="h-3 w-3" />
              <span suppressHydrationWarning>
                {formatDistanceToNow(email.receivedAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Quick action buttons: Approve, Reject, Keep, Delete */}
        <div
          className="flex flex-col gap-0.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Approve - moves to In Progress */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => onQuickAction("approve")}
            title="Approve (move to In Progress)"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          {/* Reject - moves to Rejected tab */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => onQuickAction("reject")}
            title="Not Approved (move to Rejected)"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
          {/* Keep - stays in Qualified, no tasks */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => onQuickAction("keep")}
            title="Keep (no tasks needed)"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          {/* Delete - remove from system */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-red-50"
            onClick={() => onQuickAction("delete")}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Drag Overlay Card
function EmailCardOverlay({ card }: { card: KanbanEmailCard }) {
  const email = card.email;
  const priority = email.aiClassification?.priority || "medium";

  return (
    <div className="bg-card border rounded-lg p-3 shadow-2xl w-[220px] rotate-3 ring-2 ring-primary">
      <Badge
        variant="outline"
        className={cn("text-[10px] px-1.5 py-0 mb-1", priorityColors[priority])}
      >
        {priority}
      </Badge>
      <h4 className="font-medium text-sm truncate">
        {email.matchedClientName || email.from.name}
      </h4>
      <p className="text-xs text-muted-foreground truncate">{email.subject}</p>
    </div>
  );
}

// Kanban Column
function KanbanColumnComponent({
  column,
  cards,
  isFirstColumn,
  showRejectedTab,
  rejectedCount,
  qualifiedCount,
  onTabChange,
  onCardClick,
  onCardSelect,
  onQuickAction,
  onSelectAll,
  onDeselectAll,
  selectedCount,
}: {
  column: KanbanColumn;
  cards: KanbanEmailCard[];
  isFirstColumn: boolean;
  showRejectedTab: boolean;
  rejectedCount: number;
  qualifiedCount: number;
  onTabChange: (showRejected: boolean) => void;
  onCardClick: (card: KanbanEmailCard) => void;
  onCardSelect: (cardId: string, selected: boolean) => void;
  onQuickAction: (cardId: string, action: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  selectedCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[300px] flex-shrink-0 rounded-lg transition-colors bg-muted/30",
        isOver && "bg-primary/10"
      )}
    >
      <div className="p-3 border-b bg-card rounded-t-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("w-2 h-2 rounded-full", column.color)} />
          <h3 className="font-medium text-sm">{column.title}</h3>
          <Badge variant="secondary" className="ml-auto text-xs">
            {cards.length}
          </Badge>
        </div>

        {isFirstColumn && (
          <div className="flex items-center gap-1">
            <Button
              variant={!showRejectedTab ? "default" : "ghost"}
              size="sm"
              className={cn("h-7 text-xs flex-1", !showRejectedTab && "bg-primary")}
              onClick={() => onTabChange(false)}
            >
              <Inbox className="h-3.5 w-3.5 mr-1" />
              Qualified
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {qualifiedCount}
              </Badge>
            </Button>
            <Button
              variant={showRejectedTab ? "default" : "ghost"}
              size="sm"
              className={cn("h-7 text-xs flex-1", showRejectedTab && "bg-muted-foreground")}
              onClick={() => onTabChange(true)}
            >
              <Ban className="h-3.5 w-3.5 mr-1" />
              Rejected
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {rejectedCount}
              </Badge>
            </Button>
          </div>
        )}

        {cards.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onSelectAll}>
              <CheckSquare className="h-3 w-3 mr-1" />
              All
            </Button>
            {selectedCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onDeselectAll}>
                <XSquare className="h-3 w-3 mr-1" />
                Clear ({selectedCount})
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {cards.map((card) => (
              <SortableEmailCard
                key={card.id}
                card={card}
                onClick={() => onCardClick(card)}
                onSelect={(selected) => onCardSelect(card.id, selected)}
                onQuickAction={(action) => onQuickAction(card.id, action)}
              />
            ))}
            {cards.length === 0 && (
              <div
                className={cn(
                  "text-center py-8 text-muted-foreground text-xs border-2 border-dashed rounded-lg transition-colors",
                  isOver && "border-primary bg-primary/5"
                )}
              >
                {isFirstColumn && showRejectedTab ? "No rejected emails" : "Drop emails here"}
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function EmailPage() {
  const [mounted, setMounted] = useState(false);
  const { isAdmin } = useAuth();
  const {
    accounts,
    emails,
    rejectedEmails,
    getUnreadCount,
    getRejectedCount,
    syncAllAccounts,
    isSyncing,
    markAsRelevant,
    markAsRejected,
    undoLastAction,
    addSenderRule,
    markMultipleAsRelevant,
    markMultipleAsRejected,
    createTaskFromEmail,
  } = useEmail();

  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [kanbanCards, setKanbanCards] = useState<KanbanEmailCard[]>([]);
  const [activeCard, setActiveCard] = useState<KanbanEmailCard | null>(null);
  const [showRejectedTab, setShowRejectedTab] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [editingColumns, setEditingColumns] = useState<KanbanColumn[]>([]);
  const [isSavingColumns, setIsSavingColumns] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { confirmBulkAction, state: bulkState, setOpen: setBulkOpen } = useBulkActionConfirmation();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load columns
  useEffect(() => {
    const loadColumns = async () => {
      try {
        const res = await fetch("/api/email/kanban-columns");
        if (res.ok) {
          const data = await res.json();
          if (data.columns?.length > 0) {
            setColumns([...data.columns].sort((a: KanbanColumn, b: KanbanColumn) => a.order - b.order));
          }
        }
      } catch (error) {
        console.error("Failed to load columns:", error);
      }
    };
    loadColumns();
  }, []);

  // Convert emails to kanban cards
  useEffect(() => {
    const qualified = emails.map((email) => ({
      id: `email-${email.id}`,
      email,
      columnId: "new",
      isRejected: false,
      selected: false,
    }));

    const rejected = rejectedEmails.map((email) => ({
      id: `rejected-${email.id}`,
      email,
      columnId: "new",
      isRejected: true,
      selected: false,
    }));

    setKanbanCards([...qualified, ...rejected]);
  }, [emails, rejectedEmails]);

  const filteredCards = useMemo(() => {
    let result = kanbanCards;
    if (accountFilter !== "all") {
      result = result.filter((c) => c.email.accountId === accountFilter);
    }
    if (categoryFilter !== "all") {
      result = result.filter((c) => c.email.aiClassification?.category === categoryFilter);
    }
    return result;
  }, [kanbanCards, accountFilter, categoryFilter]);

  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, KanbanEmailCard[]> = {};
    columns.forEach((col) => (grouped[col.id] = []));

    filteredCards.forEach((card) => {
      const firstColId = columns[0]?.id;
      if (card.columnId === "new" || card.columnId === firstColId) {
        if (card.isRejected === showRejectedTab && grouped[firstColId]) {
          grouped[firstColId].push(card);
        }
      } else if (grouped[card.columnId]) {
        grouped[card.columnId].push(card);
      }
    });

    return grouped;
  }, [filteredCards, columns, showRejectedTab]);

  const qualifiedCount = useMemo(() => {
    const firstColId = columns[0]?.id;
    return filteredCards.filter((c) => !c.isRejected && (c.columnId === "new" || c.columnId === firstColId)).length;
  }, [filteredCards, columns]);

  const rejectedCount = useMemo(() => {
    const firstColId = columns[0]?.id;
    return filteredCards.filter((c) => c.isRejected && (c.columnId === "new" || c.columnId === firstColId)).length;
  }, [filteredCards, columns]);

  const getSelectedCountForColumn = useCallback(
    (columnId: string) => (cardsByColumn[columnId] || []).filter((c) => c.selected).length,
    [cardsByColumn]
  );

  const totalSelected = useMemo(() => kanbanCards.filter((c) => c.selected).length, [kanbanCards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = kanbanCards.find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const activeCardData = kanbanCards.find((c) => c.id === active.id);
    if (!activeCardData) return;

    const targetColumn = columns.find((c) => c.id === over.id);
    if (targetColumn && activeCardData.columnId !== targetColumn.id) {
      setKanbanCards((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, columnId: targetColumn.id } : c))
      );
      return;
    }

    const overCard = kanbanCards.find((c) => c.id === over.id);
    if (overCard) {
      if (activeCardData.columnId !== overCard.columnId) {
        setKanbanCards((prev) =>
          prev.map((c) => (c.id === active.id ? { ...c, columnId: overCard.columnId } : c))
        );
      } else if (active.id !== over.id) {
        const oldIndex = kanbanCards.findIndex((c) => c.id === active.id);
        const newIndex = kanbanCards.findIndex((c) => c.id === over.id);
        setKanbanCards(arrayMove(kanbanCards, oldIndex, newIndex));
      }
    }
  };

  const handleCardSelect = useCallback((cardId: string, selected: boolean) => {
    setKanbanCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, selected } : c)));
  }, []);

  const handleSelectAllInColumn = useCallback(
    (columnId: string) => {
      const cardIds = new Set((cardsByColumn[columnId] || []).map((c) => c.id));
      setKanbanCards((prev) => prev.map((c) => (cardIds.has(c.id) ? { ...c, selected: true } : c)));
    },
    [cardsByColumn]
  );

  const handleDeselectAllInColumn = useCallback(
    (columnId: string) => {
      const cardIds = new Set((cardsByColumn[columnId] || []).map((c) => c.id));
      setKanbanCards((prev) => prev.map((c) => (cardIds.has(c.id) ? { ...c, selected: false } : c)));
    },
    [cardsByColumn]
  );

  const handleDeselectAll = useCallback(() => {
    setKanbanCards((prev) => prev.map((c) => ({ ...c, selected: false })));
  }, []);

  const handleQuickAction = useCallback(
    async (cardId: string, action: string) => {
      const card = kanbanCards.find((c) => c.id === cardId);
      if (!card) return;

      switch (action) {
        case "view":
          setSelectedEmail(card.email);
          break;
        case "create_task":
          const result = await createTaskFromEmail(card.email.id);
          if (result.success) {
            toast.success("Task created");
          } else {
            toast.error(result.error || "Failed to create task");
          }
          break;
        // NEW: Approve - moves to In Progress (has tasks)
        case "approve":
          setKanbanCards((prev) =>
            prev.map((c) => (c.id === cardId ? { ...c, columnId: "in_progress", isRejected: false } : c))
          );
          toast.success("Approved - moved to In Progress", {
            action: { label: "Undo", onClick: () => undoLastAction() },
          });
          break;
        // NEW: Reject - moves to Rejected tab (for training)
        case "reject":
          markAsRejected(card.email.id);
          toast.success("Rejected - moved for training", {
            action: { label: "Undo", onClick: () => undoLastAction() },
          });
          break;
        // NEW: Keep - stays in Qualified, no tasks needed
        case "keep":
          // Mark as relevant (stays in qualified) but don't move columns
          markAsRelevant(card.email.id);
          toast.success("Kept in Qualified", {
            action: { label: "Undo", onClick: () => undoLastAction() },
          });
          break;
        case "mark_relevant":
          markAsRelevant(card.email.id);
          toast.success("Marked as relevant", {
            action: { label: "Undo", onClick: () => undoLastAction() },
          });
          break;
        case "mark_rejected":
          markAsRejected(card.email.id);
          toast.success("Marked as not relevant", {
            action: { label: "Undo", onClick: () => undoLastAction() },
          });
          break;
        case "archive":
          setKanbanCards((prev) =>
            prev.map((c) => (c.id === cardId ? { ...c, columnId: "completed" } : c))
          );
          break;
        case "delete":
          setKanbanCards((prev) => prev.filter((c) => c.id !== cardId));
          toast.success("Email deleted");
          break;
      }
    },
    [kanbanCards, createTaskFromEmail, markAsRelevant, markAsRejected, undoLastAction]
  );

  const handleBulkAction = useCallback(
    async (action: string) => {
      const selectedCards = kanbanCards.filter((c) => c.selected);
      const count = selectedCards.length;
      if (count === 0) return;

      if (action === "delete" || action === "archive") {
        await confirmBulkAction({
          action: action as "delete" | "archive",
          itemCount: count,
          itemName: "email",
          onConfirm: () => {
            if (action === "archive") {
              setKanbanCards((prev) =>
                prev.map((c) => (c.selected ? { ...c, columnId: "completed", selected: false } : c))
              );
            } else {
              setKanbanCards((prev) => prev.filter((c) => !c.selected));
            }
          },
        });
        return;
      }

      switch (action) {
        case "mark_relevant":
          markMultipleAsRelevant(selectedCards.map((c) => c.email.id));
          toast.success(`${count} emails marked as relevant`);
          handleDeselectAll();
          break;
        case "mark_rejected":
          markMultipleAsRejected(selectedCards.map((c) => c.email.id));
          toast.success(`${count} emails marked as not relevant`);
          handleDeselectAll();
          break;
        case "move_in_progress":
          setKanbanCards((prev) =>
            prev.map((c) => (c.selected ? { ...c, columnId: "in_progress", selected: false } : c))
          );
          break;
        case "move_waiting":
          setKanbanCards((prev) =>
            prev.map((c) => (c.selected ? { ...c, columnId: "waiting", selected: false } : c))
          );
          break;
      }
    },
    [kanbanCards, confirmBulkAction, markMultipleAsRelevant, markMultipleAsRejected, handleDeselectAll]
  );

  // Column settings handlers
  const openColumnSettings = useCallback(() => {
    setEditingColumns([...columns]);
    setShowColumnSettings(true);
  }, [columns]);

  const saveColumns = useCallback(async (newColumns: KanbanColumn[]) => {
    setIsSavingColumns(true);
    try {
      const columnsWithOrder = newColumns.map((col, idx) => ({ ...col, order: idx }));
      const res = await fetch("/api/email/kanban-columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: columnsWithOrder }),
      });
      if (res.ok) {
        setColumns([...columnsWithOrder].sort((a, b) => a.order - b.order));
        setEditingColumns(columnsWithOrder);
        toast.success("Column settings saved");
        setShowColumnSettings(false);
      } else {
        toast.error("Failed to save columns");
      }
    } catch {
      toast.error("Failed to save columns");
    }
    setIsSavingColumns(false);
  }, []);

  const resetColumns = useCallback(async () => {
    setIsSavingColumns(true);
    try {
      const res = await fetch("/api/email/kanban-columns", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        const sorted = [...data.columns].sort((a: KanbanColumn, b: KanbanColumn) => a.order - b.order);
        setColumns(sorted);
        setEditingColumns(sorted);
        toast.success("Columns reset to defaults");
      }
    } catch {
      toast.error("Failed to reset columns");
    }
    setIsSavingColumns(false);
  }, []);

  const addColumn = useCallback(() => {
    setEditingColumns((prev) => [
      ...prev,
      { id: `col_${Date.now()}`, title: "New Column", color: "bg-slate-500", order: prev.length },
    ]);
  }, []);

  const removeColumn = useCallback((columnId: string) => {
    setEditingColumns((prev) =>
      prev.filter((c) => c.id !== columnId).map((c, idx) => ({ ...c, order: idx }))
    );
  }, []);

  const updateColumn = useCallback((columnId: string, updates: Partial<KanbanColumn>) => {
    setEditingColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, ...updates } : c)));
  }, []);

  const moveColumn = useCallback((columnId: string, direction: "up" | "down") => {
    setEditingColumns((prev) => {
      const idx = prev.findIndex((c) => c.id === columnId);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;
      const newCols = [...prev];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      [newCols[idx], newCols[targetIdx]] = [newCols[targetIdx], newCols[idx]];
      return newCols.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  const handleTrainFromSent = useCallback(async () => {
    setIsTraining(true);
    try {
      const res = await fetch("/api/email/train-from-sent", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Whitelisted ${data.stats.newDomainsWhitelisted} new domains`);
      } else {
        toast.error("Training failed");
      }
    } catch {
      toast.error("Failed to train");
    }
    setIsTraining(false);
  }, []);

  const handleWhitelistSender = useCallback(
    async (email: EmailMessage) => {
      const domain = email.from.email.split("@")[1];
      await addSenderRule({
        ruleType: "domain",
        matchType: "exact",
        matchValue: domain,
        action: "whitelist",
        reason: `Whitelisted from email`,
        isActive: true,
      });
      toast.success(`Whitelisted @${domain}`);
    },
    [addSenderRule]
  );

  const handleBlacklistSender = useCallback(
    async (email: EmailMessage) => {
      const domain = email.from.email.split("@")[1];
      await addSenderRule({
        ruleType: "domain",
        matchType: "exact",
        matchValue: domain,
        action: "blacklist",
        reason: `Blacklisted from email`,
        isActive: true,
      });
      toast.success(`Blacklisted @${domain}`);
    },
    [addSenderRule]
  );

  const handleRefresh = useCallback(async () => {
    await syncAllAccounts();
  }, [syncAllAccounts]);

  const hasConnectedAccounts = accounts.length > 0;
  const hasConnectedAndActive = accounts.some((a) => a.isConnected);

  if (!hasConnectedAccounts || !hasConnectedAndActive) {
    return (
      <>
        <Header title="Email Kanban" />
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full p-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Connect Your Email</h2>
              <p className="text-muted-foreground text-sm">
                Connect your Microsoft 365 or Outlook account in System Settings to enable
                AI-powered email processing.
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
      <Header title="Email Kanban" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-medium">Email Kanban</span>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
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
              <SelectTrigger className="w-[150px] h-8 text-xs">
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

          {totalSelected > 0 && (
            <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">{totalSelected} selected</span>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleBulkAction("move_in_progress")}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move to In Progress</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleBulkAction("mark_relevant")}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark as Relevant</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleBulkAction("mark_rejected")}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark as Not Relevant</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
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
                      onClick={() => handleBulkAction("delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
                <Button variant="ghost" size="sm" className="h-7 ml-1" onClick={handleDeselectAll}>
                  <XSquare className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <Inbox className="h-3 w-3" />
              {getUnreadCount()} unread
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Ban className="h-3 w-3" />
              {getRejectedCount()} filtered
            </Badge>
          </div>

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
                  Train
                </Button>
              </TooltipTrigger>
              <TooltipContent>Train filter from sent emails</TooltipContent>
            </Tooltip>
          )}

          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openColumnSettings}>
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Customize columns</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isSyncing ? "Syncing..." : "Refresh emails"}</TooltipContent>
          </Tooltip>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-auto p-4 bg-background">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="inline-flex gap-4 h-full min-w-max pb-4">
              {columns.map((column, idx) => (
                <KanbanColumnComponent
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] || []}
                  isFirstColumn={idx === 0}
                  showRejectedTab={showRejectedTab}
                  rejectedCount={rejectedCount}
                  qualifiedCount={qualifiedCount}
                  onTabChange={setShowRejectedTab}
                  onCardClick={(card) => setSelectedEmail(card.email)}
                  onCardSelect={handleCardSelect}
                  onQuickAction={handleQuickAction}
                  onSelectAll={() => handleSelectAllInColumn(column.id)}
                  onDeselectAll={() => handleDeselectAllInColumn(column.id)}
                  selectedCount={getSelectedCountForColumn(column.id)}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
              {activeCard && <EmailCardOverlay card={activeCard} />}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Email Detail Modal */}
        {mounted && (
          <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
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
                        <p className="text-sm text-muted-foreground">{selectedEmail.from.email}</p>
                      </div>
                      <p className="text-sm text-muted-foreground ml-auto" suppressHydrationWarning>
                        {format(selectedEmail.receivedAt, "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>

                    {selectedEmail.aiClassification && (
                      <div className="bg-primary/5 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-primary">AI Analysis</span>
                          <Badge
                            className={cn(
                              "ml-auto",
                              priorityColors[selectedEmail.aiClassification.priority]
                            )}
                          >
                            {selectedEmail.aiClassification.priority}
                          </Badge>
                        </div>
                        <p className="text-sm">{selectedEmail.aiClassification.summary}</p>
                        {selectedEmail.aiClassification.keyPoints.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {selectedEmail.aiClassification.keyPoints.map((point, idx) => (
                              <li
                                key={idx}
                                className="text-sm text-muted-foreground flex items-center gap-2"
                              >
                                <ArrowRight className="h-3 w-3 text-primary" />
                                {point}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {selectedEmail.bodyType === "html" ? (
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <iframe
                          srcDoc={selectedEmail.body}
                          className="w-full min-h-[300px] border-0"
                          sandbox="allow-same-origin"
                          title="Email content"
                          onLoad={(e) => {
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

                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
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
                <div className="flex gap-2 mr-auto flex-wrap">
                  {/* 4 Action Buttons: Approve, Reject, Keep, Delete */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                    onClick={() => {
                      if (selectedEmail) {
                        const card = kanbanCards.find((c) => c.email.id === selectedEmail.id);
                        if (card) {
                          setKanbanCards((prev) =>
                            prev.map((c) => (c.email.id === selectedEmail.id ? { ...c, columnId: "in_progress", isRejected: false } : c))
                          );
                        }
                        toast.success("Approved - moved to In Progress");
                        setSelectedEmail(null);
                      }
                    }}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1.5" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                    onClick={() => {
                      if (selectedEmail) {
                        markAsRejected(selectedEmail.id);
                        toast.success("Rejected - moved for training", {
                          action: { label: "Undo", onClick: () => undoLastAction() },
                        });
                        setSelectedEmail(null);
                      }
                    }}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1.5" />
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                    onClick={() => {
                      if (selectedEmail) {
                        markAsRelevant(selectedEmail.id);
                        toast.success("Kept in Qualified");
                        setSelectedEmail(null);
                      }
                    }}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Keep
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive hover:bg-red-50 border-muted"
                    onClick={() => {
                      if (selectedEmail) {
                        setKanbanCards((prev) => prev.filter((c) => c.email.id !== selectedEmail.id));
                        toast.success("Email deleted");
                        setSelectedEmail(null);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
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

        {/* Column Settings Modal */}
        {mounted && (
          <Dialog open={showColumnSettings} onOpenChange={(open) => !open && setShowColumnSettings(false)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Customize Kanban Columns
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  Add, remove, rename, or reorder columns.
                </p>
                <div className="space-y-2">
                  {editingColumns.map((col, idx) => (
                    <div key={col.id} className="flex items-center gap-2 p-2 border rounded-lg bg-card">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8">
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
                              />
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Input
                        value={col.title}
                        onChange={(e) => updateColumn(col.id, { title: e.target.value })}
                        className="flex-1 h-8"
                      />
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
                <Button variant="outline" className="w-full" onClick={addColumn}>
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
                  Reset
                </Button>
                <Button variant="outline" onClick={() => setShowColumnSettings(false)} disabled={isSavingColumns}>
                  Cancel
                </Button>
                <Button onClick={() => saveColumns(editingColumns)} disabled={isSavingColumns || editingColumns.length === 0}>
                  {isSavingColumns ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

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
