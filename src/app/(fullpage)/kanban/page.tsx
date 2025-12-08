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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TaskDetailModal } from "@/app/(dashboard)/taskpool/task-detail-modal";
import { CreateTaskDialog } from "@/app/(dashboard)/taskpool/create-task-dialog";
import Link from "next/link";

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
const colorMap: Record<string, { text: string; bg: string }> = {
  "gray": { text: "text-gray-500", bg: "bg-gray-100" },
  "blue": { text: "text-blue-500", bg: "bg-blue-100" },
  "orange": { text: "text-orange-500", bg: "bg-orange-100" },
  "green": { text: "text-green-500", bg: "bg-green-100" },
  "red": { text: "text-red-500", bg: "bg-red-100" },
  "purple": { text: "text-purple-500", bg: "bg-purple-100" },
  "yellow": { text: "text-yellow-500", bg: "bg-yellow-100" },
  "pink": { text: "text-pink-500", bg: "bg-pink-100" },
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

export default function KanbanBoardPage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Column settings state
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("gray");
  const [newColumnIcon, setNewColumnIcon] = useState("circle");
  const [savingColumn, setSavingColumn] = useState(false);

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
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      // Load assigned tasks (tasks that have been assigned to someone)
      const response = await fetch("/api/taskpool/tasks?view=all");
      if (response.ok) {
        const data = await response.json();
        // Only show tasks that are assigned
        const assignedTasks = (data.tasks || []).filter((t: Task) => t.assigned_to);
        setTasks(assignedTasks);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const handleAddColumn = async () => {
    if (!newColumnLabel.trim()) {
      toast.error("Column label is required");
      return;
    }

    setSavingColumn(true);
    try {
      const response = await fetch("/api/kanban/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newColumnLabel,
          color: newColumnColor,
          icon: newColumnIcon,
        }),
      });

      if (response.ok) {
        toast.success("Column added successfully");
        setNewColumnLabel("");
        setNewColumnColor("gray");
        setNewColumnIcon("circle");
        loadColumns();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to add column");
      }
    } catch (error) {
      console.error("Error adding column:", error);
      toast.error("Failed to add column");
    } finally {
      setSavingColumn(false);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    try {
      const response = await fetch(`/api/kanban/columns/${columnId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Column removed successfully");
        loadColumns();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove column");
      }
    } catch (error) {
      console.error("Error removing column:", error);
      toast.error("Failed to remove column");
    }
  };

  useEffect(() => {
    loadActionTypes();
    loadUsers();
    loadColumns();
  }, [loadActionTypes, loadUsers, loadColumns]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleClaimTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/claim`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Task claimed successfully");
        loadTasks(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to claim task");
      }
    } catch (error) {
      console.error("Error claiming task:", error);
      toast.error("Failed to claim task");
    }
  };

  const handleReleaseTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/claim`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Task released");
        loadTasks(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to release task");
      }
    } catch (error) {
      console.error("Error releasing task:", error);
      toast.error("Failed to release task");
    }
  };

  const handleChangeStatus = async (taskId: string, status: string) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success("Task status updated");
        loadTasks(false);
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  // Track dragged task ID in ref for reliability across events
  const draggedTaskIdRef = useRef<string | null>(null);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    // Store in both state and ref for reliability
    setDraggedTask(task);
    draggedTaskIdRef.current = task.id;

    // Set drag data
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.setData("application/x-task-id", task.id);

    // Create a custom drag image
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    dragImage.style.opacity = "0.8";
    dragImage.style.transform = "rotate(3deg)";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 50, 30);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    // Visual feedback on source
    const target = e.currentTarget as HTMLElement;
    if (target) {
      requestAnimationFrame(() => {
        target.style.opacity = "0.4";
        target.style.transform = "scale(0.98)";
      });
    }
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

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragEnter = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    // Only clear if actually leaving the drop zone
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);

    // Try multiple methods to get the task ID
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
      console.error("Drop failed: No task ID found");
      toast.error("Drop failed - please try again");
      return;
    }

    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove) {
      console.error("Drop failed: Task not found in list");
      toast.error("Task not found - please refresh");
      return;
    }

    try {
      if (taskToMove.status !== statusId) {
        await handleChangeStatus(taskToMove.id, statusId);
      }
    } catch (error) {
      console.error("Drop action failed:", error);
      toast.error("Failed to move task");
    }

    setDraggedTask(null);
    draggedTaskIdRef.current = null;
  };

  // Get tasks by status
  const getTasksByStatus = (status: string) =>
    tasks.filter(t => t.status === status);

  // Filter tasks by search and filters
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

    if (assigneeFilter !== "all") {
      filtered = filtered.filter(t => t.assigned_to === assigneeFilter);
    }

    return filtered;
  };

  const getUserInitials = (user: UserProfile) => {
    if (user.full_name) {
      return user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const renderTaskCard = (task: Task) => {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date();
    const createdDate = new Date(task.created_at);
    const isRecent = (Date.now() - createdDate.getTime()) < 24 * 60 * 60 * 1000;
    const assignedUser = task.assigned_to ? users.find(u => u.id === task.assigned_to) : null;

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
          draggedTask?.id === task.id && "opacity-40 scale-[0.98] cursor-grabbing"
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
            <GripVertical className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
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

          {/* Footer with assignee and metadata */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            {/* Assignee */}
            {assignedUser && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={assignedUser.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {getUserInitials(assignedUser)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  {assignedUser.full_name?.split(" ")[0] || assignedUser.email.split("@")[0]}
                </span>
              </div>
            )}

            {/* Due date */}
            {task.due_date && (
              <span className={cn(
                "text-[10px] flex items-center gap-0.5 ml-auto",
                isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
              )}>
                <Clock className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
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
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Kanban className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Kanban Board</h1>
                <p className="text-xs text-muted-foreground">
                  Track assigned tasks by status
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-56 h-9"
              />
            </div>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Link href="/taskpool-board">
              <Button variant="outline" className="h-9 gap-2">
                <Archive className="h-4 w-4" />
                TaskPool
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsDialog(true)}
              className="h-9"
            >
              <Settings className="h-4 w-4" />
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
                      isDropTarget && "ring-2 ring-blue-500 ring-offset-2"
                    )}
                    onDragOver={(e) => handleDragOver(e, column.code)}
                    onDragEnter={(e) => handleDragEnter(e, column.code)}
                    onDragLeave={(e) => handleDragLeave(e)}
                    onDrop={(e) => handleDrop(e, column.code)}
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
                      className="flex-1 p-2 space-y-2 overflow-y-auto bg-muted/10"
                    >
                      {columnTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <Icon className={cn("h-6 w-6 opacity-30 mb-2", colors.text)} />
                          <p className="text-xs">No tasks</p>
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
          onClaim={handleClaimTask}
          onRelease={handleReleaseTask}
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

      {/* Column Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Kanban Column Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Existing Columns */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Current Columns</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {columns.map((column) => {
                  const Icon = iconMap[column.icon] || Circle;
                  const colors = colorMap[column.color] || colorMap.gray;
                  const taskCount = tasks.filter(t => t.status === column.code).length;

                  return (
                    <div
                      key={column.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border",
                        colors.bg
                      )}
                    >
                      <Icon className={cn("h-4 w-4", colors.text)} />
                      <span className="text-sm font-medium flex-1">{column.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {taskCount} tasks
                      </Badge>
                      {!column.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDeleteColumn(column.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {column.is_default && (
                        <span className="text-[10px] text-muted-foreground">Default</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add New Column */}
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">Add New Column</Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Label</Label>
                  <Input
                    placeholder="e.g., Waiting for Client"
                    value={newColumnLabel}
                    onChange={(e) => setNewColumnLabel(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Icon</Label>
                    <Select value={newColumnIcon} onValueChange={setNewColumnIcon}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(iconMap).map(([key, IconComponent]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <IconComponent className="h-4 w-4" />
                              <span className="capitalize">{key.replace("-", " ")}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Color</Label>
                    <Select value={newColumnColor} onValueChange={setNewColumnColor}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(colorMap).map(([key, colors]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <div className={cn("h-3 w-3 rounded-full", colors.bg, "border")} />
                              <span className="capitalize">{key}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleAddColumn}
                  disabled={savingColumn || !newColumnLabel.trim()}
                  className="w-full"
                >
                  {savingColumn ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Column
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
