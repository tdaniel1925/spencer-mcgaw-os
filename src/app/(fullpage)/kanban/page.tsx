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
} from "lucide-react";
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

// Kanban status columns
const statusColumns = [
  { id: "open", label: "To Do", icon: Circle, color: "text-gray-500", bgColor: "bg-gray-100" },
  { id: "in_progress", label: "In Progress", icon: PlayCircle, color: "text-blue-500", bgColor: "bg-blue-100" },
  { id: "review", label: "Review", icon: Eye, color: "text-orange-500", bgColor: "bg-orange-100" },
  { id: "completed", label: "Done", icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-100" },
];

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  useEffect(() => {
    loadActionTypes();
    loadUsers();
  }, [loadActionTypes, loadUsers]);

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

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.stopPropagation();
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragEnter = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);

    if (!draggedTask) return;

    if (draggedTask.status !== statusId) {
      await handleChangeStatus(draggedTask.id, statusId);
    }

    setDraggedTask(null);
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
        draggable={true}
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={(e) => handleDragEnd(e)}
        onMouseDown={(e) => {
          e.currentTarget.dataset.dragging = "false";
        }}
        onMouseMove={(e) => {
          if (e.buttons === 1) {
            e.currentTarget.dataset.dragging = "true";
          }
        }}
        className={cn(
          "bg-background rounded-lg border cursor-grab transition-all duration-200",
          "hover:shadow-md hover:border-border/80",
          "group relative overflow-hidden select-none",
          draggedTask?.id === task.id && "opacity-50 cursor-grabbing"
        )}
        onClick={(e) => {
          const target = e.currentTarget as HTMLElement;
          if (target.dataset.dragging !== "true") {
            setSelectedTask(task);
          }
        }}
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
              {statusColumns.map((column) => {
                const Icon = column.icon;
                const columnTasks = filterTasks(getTasksByStatus(column.id));
                const isDropTarget = dragOverColumn === column.id;

                return (
                  <div
                    key={column.id}
                    className={cn(
                      "w-80 flex-shrink-0 flex flex-col bg-card rounded-xl shadow-sm border overflow-hidden transition-all",
                      isDropTarget && "ring-2 ring-blue-500 ring-offset-2"
                    )}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragEnter={(e) => handleDragEnter(e, column.id)}
                    onDragLeave={(e) => handleDragLeave(e)}
                    onDrop={(e) => handleDrop(e, column.id)}
                  >
                    {/* Column Header */}
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2.5 border-b",
                      column.bgColor
                    )}>
                      <Icon className={cn("h-4 w-4", column.color)} />
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
                          <Icon className={cn("h-6 w-6 opacity-30 mb-2", column.color)} />
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
    </div>
  );
}
