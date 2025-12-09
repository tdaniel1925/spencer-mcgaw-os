"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Kanban,
  Plus,
  Search,
  Filter,
  User,
  Clock,
  RefreshCw,
  MessageSquare,
  FileText,
  Eye,
  HelpCircle,
  Send,
  Calendar,
  Settings,
  ArrowLeft,
  Users,
  ChevronDown,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  PlayCircle,
  Archive,
  Trash2,
  Edit,
  X,
  Loader2,
  PauseCircle,
  AlertCircle,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TaskDetailModal } from "@/app/(dashboard)/taskpool/task-detail-modal";
import { CreateTaskDialog } from "@/app/(dashboard)/taskpool/create-task-dialog";
import Link from "next/link";
import { useAuth } from "@/lib/supabase/auth-context";

interface ActionType {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  action_type_id: string;
  client_id: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  alert_threshold_hours: number | null;
  alert_dismissed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
  ai_confidence: number | null;
  ai_extracted_data: Record<string, any>;
  source_type: string;
  action_type: ActionType | null;
  client: Client | null;
  notes: { count: number }[];
  activity: { count: number }[];
  // Handoff fields
  handoff_to: string | null;
  handoff_from: string | null;
  handoff_notes: string | null;
  handoff_at: string | null;
}

// Kanban column from database
interface KanbanColumn {
  id: string;
  code: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
}

// Stats for the dashboard header
interface UserStats {
  total: number;
  overdue: number;
  dueToday: number;
  urgent: number;
  pendingHandoffs: number;
}

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  "circle": Circle,
  "play-circle": PlayCircle,
  "eye": Eye,
  "check-circle": CheckCircle,
  "pause-circle": PauseCircle,
  "alert-circle": AlertCircle,
  "archive": Archive,
  "clock": Clock,
};

// Color mapping
const colorMap: Record<string, { text: string; bg: string; border: string }> = {
  "gray": { text: "text-gray-500", bg: "bg-gray-100", border: "border-gray-200" },
  "blue": { text: "text-blue-500", bg: "bg-blue-100", border: "border-blue-200" },
  "orange": { text: "text-orange-500", bg: "bg-orange-100", border: "border-orange-200" },
  "green": { text: "text-green-500", bg: "bg-green-100", border: "border-green-200" },
  "red": { text: "text-red-500", bg: "bg-red-100", border: "border-red-200" },
  "purple": { text: "text-purple-500", bg: "bg-purple-100", border: "border-purple-200" },
  "yellow": { text: "text-yellow-500", bg: "bg-yellow-100", border: "border-yellow-200" },
  "pink": { text: "text-pink-500", bg: "bg-pink-100", border: "border-pink-200" },
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

const priorityDotColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

// Helper to format time elapsed since a date
function formatTimeElapsed(dateString: string): { text: string; isOld: boolean } {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  let text: string;
  let isOld = false;

  if (diffMins < 60) {
    text = `${diffMins}m`;
  } else if (diffHours < 24) {
    text = `${diffHours}h`;
    if (diffHours >= 8) isOld = true;
  } else if (diffDays < 7) {
    text = `${diffDays}d`;
    isOld = true;
  } else if (diffWeeks < 4) {
    text = `${diffWeeks}w`;
    isOld = true;
  } else {
    text = `${diffMonths}mo`;
    isOld = true;
  }

  return { text, isOld };
}

// Helper to format due date countdown
function formatDueCountdown(dueDate: string): { text: string; status: 'overdue' | 'urgent' | 'soon' | 'ok' } {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      text: overdueDays === 0 ? 'Overdue' : `${overdueDays}d overdue`,
      status: 'overdue'
    };
  } else if (diffHours < 4) {
    return { text: `${diffHours}h left`, status: 'urgent' };
  } else if (diffDays === 0) {
    return { text: 'Due today', status: 'soon' };
  } else if (diffDays === 1) {
    return { text: 'Due tomorrow', status: 'soon' };
  } else {
    return { text: `${diffDays}d left`, status: 'ok' };
  }
}

export default function MyBoardPage() {
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [stats, setStats] = useState<UserStats>({ total: 0, overdue: 0, dueToday: 0, urgent: 0, pendingHandoffs: 0 });

  // Check scroll position to show/hide arrow buttons
  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    }
  }, []);

  // Scroll handlers for arrow buttons
  const scrollLeft = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  // Mouse wheel horizontal scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    const container = scrollContainerRef.current;
    if (container) {
      const target = e.target as HTMLElement;
      const isInScrollableColumn = target.closest('[data-column-content]');

      if (!isInScrollableColumn || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY + e.deltaX;
        updateScrollButtons();
      }
    }
  }, [updateScrollButtons]);

  // Set up wheel listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      container.addEventListener("scroll", updateScrollButtons);
      updateScrollButtons();

      return () => {
        container.removeEventListener("wheel", handleWheel);
        container.removeEventListener("scroll", updateScrollButtons);
      };
    }
  }, [handleWheel, updateScrollButtons, loading]);

  const loadActionTypes = useCallback(async () => {
    try {
      const response = await fetch("/api/taskpool/action-types");
      if (response.ok) {
        const data = await response.json();
        setActionTypes(data.actionTypes || []);
      }
    } catch (error) {
      console.error("Error loading action types:", error);
    }
  }, []);

  const loadTasks = useCallback(async (showLoading = true) => {
    if (!user) return;

    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      // Load tasks assigned to OR claimed by current user
      const response = await fetch(`/api/taskpool/tasks?view=my_assigned`);
      if (response.ok) {
        const data = await response.json();
        const myTasks = data.tasks || [];
        setTasks(myTasks);

        // Calculate stats
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const incomplete = myTasks.filter((t: Task) => t.status !== 'completed');

        setStats({
          total: incomplete.length,
          overdue: incomplete.filter((t: Task) => t.due_date && new Date(t.due_date) < today).length,
          dueToday: incomplete.filter((t: Task) => {
            if (!t.due_date) return false;
            const due = new Date(t.due_date);
            return due.getFullYear() === today.getFullYear() &&
                   due.getMonth() === today.getMonth() &&
                   due.getDate() === today.getDate();
          }).length,
          urgent: incomplete.filter((t: Task) => t.priority === 'urgent').length,
          pendingHandoffs: 0, // Will be populated when handoff feature is implemented
        });
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }, []);

  const loadColumns = useCallback(async () => {
    try {
      const response = await fetch("/api/kanban/columns");
      if (response.ok) {
        const data = await response.json();
        setColumns(data.columns || []);
      }
    } catch (error) {
      console.error("Error loading columns:", error);
    }
  }, []);

  useEffect(() => {
    loadActionTypes();
    loadUsers();
    loadColumns();
  }, [loadActionTypes, loadUsers, loadColumns]);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [loadTasks, user]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success("Task completed!");
        loadTasks(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to complete task");
      }
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Failed to complete task");
    }
  };

  const handleChangeStatus = async (taskId: string, status: string) => {
    // Optimistic update
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status } : t
    ));

    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success("Status updated");
      } else {
        setTasks(previousTasks);
        toast.error("Failed to update status");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      setTasks(previousTasks);
      toast.error("Failed to update task");
    }
  };

  // Track dragged task ID in ref for reliability
  const draggedTaskIdRef = useRef<string | null>(null);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    draggedTaskIdRef.current = task.id;

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.setData("application/x-task-id", task.id);

    const sourceElement = e.currentTarget as HTMLElement;
    const rect = sourceElement.getBoundingClientRect();
    const dragImage = sourceElement.cloneNode(true) as HTMLElement;

    dragImage.style.width = `${rect.width}px`;
    dragImage.style.height = `${rect.height}px`;
    dragImage.style.position = "fixed";
    dragImage.style.top = "-9999px";
    dragImage.style.left = "-9999px";
    dragImage.style.opacity = "0.9";
    dragImage.style.transform = "rotate(2deg)";
    dragImage.style.pointerEvents = "none";
    dragImage.style.zIndex = "9999";
    dragImage.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
    dragImage.style.borderRadius = "8px";
    dragImage.style.overflow = "hidden";

    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, rect.width / 2, 20);

    requestAnimationFrame(() => {
      setTimeout(() => {
        if (dragImage.parentNode) {
          document.body.removeChild(dragImage);
        }
      }, 0);
    });

    requestAnimationFrame(() => {
      sourceElement.style.opacity = "0.4";
      sourceElement.style.transform = "scale(0.98)";
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    if (target) {
      target.style.opacity = "1";
      target.style.transform = "";
    }
    setDraggedTask(null);
    draggedTaskIdRef.current = null;
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);

    let taskId = draggedTaskIdRef.current;
    if (!taskId) {
      taskId = e.dataTransfer.getData("application/x-task-id");
    }
    if (!taskId) {
      taskId = e.dataTransfer.getData("text/plain");
    }
    if (!taskId && draggedTask) {
      taskId = draggedTask.id;
    }

    if (!taskId) {
      toast.error("Drop failed - please try again");
      return;
    }

    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove) {
      toast.error("Task not found - please refresh");
      return;
    }

    if (taskToMove.status !== statusId) {
      await handleChangeStatus(taskToMove.id, statusId);
    }

    setDraggedTask(null);
    draggedTaskIdRef.current = null;
  };

  // Get tasks by status
  const getTasksByStatus = (status: string) =>
    tasks.filter(t => t.status === status);

  // Filter tasks
  const filterTasks = (taskList: Task[]) => {
    let filtered = taskList;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.client?.first_name?.toLowerCase().includes(query) ||
          task.client?.last_name?.toLowerCase().includes(query) ||
          task.client?.company?.toLowerCase().includes(query)
      );
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    return filtered;
  };

  const getUserInitials = (userProfile: UserProfile) => {
    if (userProfile.full_name) {
      return userProfile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return userProfile.email.slice(0, 2).toUpperCase();
  };

  const renderTaskCard = (task: Task) => {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date();
    const timerDate = task.assigned_at || task.created_at;
    const { text: timerText, isOld } = formatTimeElapsed(timerDate);
    const dueInfo = task.due_date ? formatDueCountdown(task.due_date) : null;

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        className={cn(
          "bg-background rounded-lg border cursor-grab transition-all duration-200",
          "hover:shadow-md hover:border-border/80",
          "group relative overflow-hidden select-none",
          draggedTask?.id === task.id && "opacity-40 scale-[0.98] cursor-grabbing",
          // Due date alerts
          dueInfo?.status === 'overdue' && "ring-2 ring-red-400 animate-pulse",
          dueInfo?.status === 'urgent' && "ring-2 ring-orange-400",
          dueInfo?.status === 'soon' && "ring-1 ring-amber-300"
        )}
        onClick={() => setSelectedTask(task)}
      >
        {/* Priority indicator strip */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1",
            priorityDotColors[task.priority] || "bg-gray-300"
          )}
        />

        <div className="p-3 pl-3.5">
          {/* Header row with badges */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-1.5 py-0 font-medium capitalize",
                  priorityColors[task.priority]
                )}
              >
                {task.priority}
              </Badge>
              {task.action_type && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{ borderColor: task.action_type.color, color: task.action_type.color }}
                >
                  {task.action_type.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-1.5 py-0 font-medium flex items-center gap-0.5",
                  isOld ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                )}
              >
                <Clock className="h-2.5 w-2.5" />
                {timerText}
              </Badge>
              <GripVertical className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
            </div>
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium leading-snug text-foreground mb-1 line-clamp-2">
            {task.title}
          </h4>

          {/* Description preview */}
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
              {task.description}
            </p>
          )}

          {/* Footer with due date and complete button */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            {/* Due date countdown */}
            {dueInfo && (
              <span className={cn(
                "text-[10px] flex items-center gap-0.5 font-medium",
                dueInfo.status === 'overdue' && "text-red-600",
                dueInfo.status === 'urgent' && "text-orange-600",
                dueInfo.status === 'soon' && "text-amber-600",
                dueInfo.status === 'ok' && "text-muted-foreground"
              )}>
                <Clock className="h-3 w-3" />
                {dueInfo.text}
              </span>
            )}

            {/* Quick complete button */}
            {task.status !== 'completed' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCompleteTask(task.id);
                }}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-muted/20">
      {/* Header */}
      <div className="bg-background border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">My Board</h1>
                <p className="text-xs text-muted-foreground">
                  Your personal task workspace
                </p>
              </div>
            </div>
          </div>

          {/* Stats summary */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6 px-4 py-2 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold">{stats.total}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Active</div>
              </div>
              {stats.overdue > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{stats.overdue}</div>
                  <div className="text-[10px] text-red-600 uppercase">Overdue</div>
                </div>
              )}
              {stats.dueToday > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-600">{stats.dueToday}</div>
                  <div className="text-[10px] text-amber-600 uppercase">Due Today</div>
                </div>
              )}
              {stats.urgent > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">{stats.urgent}</div>
                  <div className="text-[10px] text-orange-600 uppercase">Urgent</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search my tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-56 h-9"
              />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTasks(false)}
              disabled={refreshing}
              className="h-9"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            <Link href="/kanban">
              <Button variant="outline" className="h-9 gap-2">
                <Users className="h-4 w-4" />
                Team Board
              </Button>
            </Link>
            <Link href="/taskpool-board">
              <Button variant="outline" className="h-9 gap-2">
                <Archive className="h-4 w-4" />
                Task Pool
              </Button>
            </Link>
            <Button onClick={() => setShowCreateDialog(true)} className="h-9 gap-2">
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 relative min-h-0">
        {/* Scroll Arrow Buttons */}
        {canScrollLeft && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-sm"
            onClick={scrollLeft}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        {canScrollRight && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-sm"
            onClick={scrollRight}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className="h-full overflow-x-auto p-4 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
        >
          {loading ? (
            <div className="flex gap-4 h-full">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-80 flex-shrink-0 space-y-3">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-500/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">All caught up!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  No tasks assigned to you right now.
                </p>
                <Link href="/taskpool-board">
                  <Button variant="outline" className="gap-2">
                    <Archive className="h-4 w-4" />
                    Browse Task Pool
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 h-full">
              {/* Status Columns */}
              {columns.map((column) => {
                const Icon = iconMap[column.icon] || Circle;
                const colors = colorMap[column.color] || colorMap.gray;
                const columnTasks = filterTasks(getTasksByStatus(column.code));
                const isDropTarget = dragOverColumn === column.code;

                return (
                  <div
                    key={column.id}
                    className={cn(
                      "w-80 flex-shrink-0 flex flex-col bg-card rounded-xl shadow-sm border overflow-hidden transition-all",
                      isDropTarget && "ring-2 ring-primary ring-offset-2 bg-primary/5"
                    )}
                  >
                    {/* Column Header */}
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2.5 border-b",
                      colors.bg
                    )}>
                      <Icon className={cn("h-4 w-4", colors.text)} />
                      <span className="font-semibold text-sm text-foreground flex-1">
                        {column.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {columnTasks.length}
                      </Badge>
                    </div>

                    {/* Column Content */}
                    <div
                      data-column-content
                      data-column-code={column.code}
                      className={cn(
                        "flex-1 p-2 space-y-2 overflow-y-auto bg-muted/10 min-h-[200px]",
                        isDropTarget && "bg-primary/5"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverColumn(column.code);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverColumn(column.code);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX;
                        const y = e.clientY;
                        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                          setDragOverColumn(null);
                        }
                      }}
                      onDrop={(e) => handleDrop(e, column.code)}
                    >
                      {columnTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground pointer-events-none">
                          <Icon className={cn("h-6 w-6 opacity-30 mb-2", colors.text)} />
                          <p className="text-xs">Drop tasks here</p>
                        </div>
                      ) : (
                        columnTasks.map((task) => renderTaskCard(task))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          actionTypes={actionTypes}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            loadTasks(false);
            setSelectedTask(null);
          }}
          onClaim={() => {}}
          onRelease={() => {}}
        />
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        actionTypes={actionTypes}
        onCreated={() => {
          loadTasks(false);
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}
