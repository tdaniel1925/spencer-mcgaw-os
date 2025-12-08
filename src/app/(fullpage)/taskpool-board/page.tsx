"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Layers,
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
  AlertTriangle,
  Bell,
  X,
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

const iconMap: Record<string, React.ElementType> = {
  "message-square": MessageSquare,
  "file-text": FileText,
  eye: Eye,
  "help-circle": HelpCircle,
  send: Send,
  calendar: Calendar,
  settings: Settings,
  clipboard: FileText,
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

// Helper function to format time elapsed
function formatTimeElapsed(dateString: string): { text: string; isOld: boolean } {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

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
  } else {
    text = `${diffWeeks}w`;
    isOld = true;
  }

  return { text, isOld };
}

// Helper to check due date alert status
interface DueDateAlertStatus {
  isOverdue: boolean;
  isApproaching: boolean;
  isUrgent: boolean;
  hoursRemaining: number | null;
  text: string | null;
}

function getDueDateAlertStatus(
  dueDate: string | null,
  alertThresholdHours: number | null,
  alertDismissed: boolean
): DueDateAlertStatus {
  if (!dueDate) {
    return { isOverdue: false, isApproaching: false, isUrgent: false, hoursRemaining: null, text: null };
  }

  const now = new Date();
  const due = new Date(dueDate);
  // Set due date to end of day if it's just a date
  if (!dueDate.includes('T')) {
    due.setHours(23, 59, 59, 999);
  }

  const diffMs = due.getTime() - now.getTime();
  const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60));
  const threshold = alertThresholdHours || 24;

  const isOverdue = diffMs < 0;
  const isApproaching = !isOverdue && hoursRemaining <= threshold && !alertDismissed;
  const isUrgent = !isOverdue && hoursRemaining <= Math.min(threshold / 2, 4) && !alertDismissed;

  let text: string | null = null;
  if (isOverdue) {
    const overdueDays = Math.abs(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    text = overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`;
  } else if (hoursRemaining < 24) {
    text = hoursRemaining <= 1 ? "Due within 1 hour" : `Due in ${hoursRemaining}h`;
  } else {
    const daysRemaining = Math.ceil(hoursRemaining / 24);
    text = daysRemaining === 1 ? "Due tomorrow" : `Due in ${daysRemaining} days`;
  }

  return { isOverdue, isApproaching, isUrgent, hoursRemaining, text };
}

export default function TaskPoolBoardPage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showAlertBanner, setShowAlertBanner] = useState(true);

  // Get tasks with due date alerts
  const tasksWithAlerts = tasks.filter(t => {
    if (t.status === "completed" || !t.due_date) return false;
    const alert = getDueDateAlertStatus(t.due_date, t.alert_threshold_hours, t.alert_dismissed || false);
    return alert.isOverdue || alert.isApproaching;
  });
  const overdueCount = tasksWithAlerts.filter(t => {
    const alert = getDueDateAlertStatus(t.due_date, t.alert_threshold_hours, t.alert_dismissed || false);
    return alert.isOverdue;
  }).length;
  const approachingCount = tasksWithAlerts.length - overdueCount;

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
      // Only handle horizontal scroll if not scrolling vertically within a column
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
      // Load all non-completed tasks for the board
      const response = await fetch("/api/taskpool/tasks?view=all");
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
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
      // Fetch only users who should appear in the TaskPool ribbon
      const response = await fetch("/api/users?taskpool=true");
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

  const handleAssignTask = async (taskId: string, userId: string) => {
    // Optimistic update - immediately update the UI
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, assigned_to: userId } : t
    ));

    const user = users.find(u => u.id === userId);
    toast.success(`Task assigned to ${user?.full_name || user?.email || "user"}`);

    try {
      console.log("Assigning task:", { taskId, userId });
      const response = await fetch(`/api/taskpool/tasks/${taskId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: userId }),
      });

      const data = await response.json();
      console.log("Assignment response:", { ok: response.ok, data });

      if (!response.ok) {
        // Revert on error
        console.error("Assignment failed:", data);
        setTasks(previousTasks);
        toast.error(data.error || "Failed to assign task");
      }
    } catch (error) {
      // Revert on error
      console.error("Error assigning task:", error);
      setTasks(previousTasks);
      toast.error("Failed to assign task");
    }
  };

  const handleChangeActionType = async (taskId: string, actionTypeId: string) => {
    // Optimistic update - immediately update the UI
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, action_type_id: actionTypeId } : t
    ));
    toast.success("Task moved");

    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type_id: actionTypeId }),
      });

      if (!response.ok) {
        // Revert on error
        setTasks(previousTasks);
        toast.error("Failed to move task");
      }
    } catch (error) {
      // Revert on error
      console.error("Error moving task:", error);
      setTasks(previousTasks);
      toast.error("Failed to move task");
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

    // Create a custom drag image that preserves the card's appearance
    const sourceElement = e.currentTarget as HTMLElement;
    const rect = sourceElement.getBoundingClientRect();
    const dragImage = sourceElement.cloneNode(true) as HTMLElement;

    // Set fixed dimensions to match the original card
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

    // Remove after a brief delay
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (dragImage.parentNode) {
          document.body.removeChild(dragImage);
        }
      }, 0);
    });

    // Visual feedback on source
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

  const handleDrop = async (e: React.DragEvent, columnId: string, columnType: "action" | "user") => {
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
      console.log("Drop handler:", { columnId, columnType, taskId, taskToMove: taskToMove.id });
      if (columnType === "action") {
        if (taskToMove.action_type_id !== columnId) {
          await handleChangeActionType(taskToMove.id, columnId);
        }
      } else if (columnType === "user") {
        console.log("User drop - current assigned_to:", taskToMove.assigned_to, "target userId:", columnId);
        if (taskToMove.assigned_to !== columnId) {
          await handleAssignTask(taskToMove.id, columnId);
        } else {
          console.log("Task already assigned to this user");
        }
      }
    } catch (error) {
      console.error("Drop action failed:", error);
      toast.error("Failed to move task");
    }

    setDraggedTask(null);
    draggedTaskIdRef.current = null;
  };

  // Group tasks
  // Tasks in action type columns - show all non-completed tasks (assigned and unassigned)
  const getTasksByActionType = (actionTypeId: string) =>
    tasks.filter(t => t.action_type_id === actionTypeId && t.status !== "completed");

  // Tasks assigned to a specific user
  const getTasksByUser = (userId: string) =>
    tasks.filter(t => t.assigned_to === userId && t.status !== "completed");

  // Filter tasks by search
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

  const getActionIcon = (iconName: string) => {
    return iconMap[iconName] || FileText;
  };

  const getUserInitials = (user: UserProfile) => {
    if (user.full_name) {
      return user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const renderTaskCard = (task: Task, showAssignDropdown = true) => {
    const createdDate = new Date(task.created_at);
    const isRecent = (Date.now() - createdDate.getTime()) < 24 * 60 * 60 * 1000;
    const assignedUser = task.assigned_to ? users.find(u => u.id === task.assigned_to) : null;

    // Timer: show time since creation or time since assignment
    const timeElapsed = task.assigned_at
      ? formatTimeElapsed(task.assigned_at)
      : formatTimeElapsed(task.created_at);
    const timerLabel = task.assigned_at ? "assigned" : "waiting";

    // Due date alert status
    const dueDateAlert = getDueDateAlertStatus(
      task.due_date,
      task.alert_threshold_hours,
      task.alert_dismissed || false
    );

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
          dueDateAlert.isOverdue && "ring-2 ring-red-500 ring-offset-1 animate-pulse",
          dueDateAlert.isUrgent && !dueDateAlert.isOverdue && "ring-2 ring-orange-500 ring-offset-1 animate-pulse",
          dueDateAlert.isApproaching && !dueDateAlert.isUrgent && !dueDateAlert.isOverdue && "ring-1 ring-amber-400"
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
          {/* Header row with badges and actions */}
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
              {isRecent && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200"
                >
                  New
                </Badge>
              )}
              {assignedUser && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200"
                >
                  Assigned
                </Badge>
              )}
            </div>

            {/* Timer and drag handle */}
            <div className="flex items-center gap-1">
              <div
                className={cn(
                  "flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded",
                  timeElapsed.isOld
                    ? "bg-amber-100 text-amber-700 animate-pulse"
                    : "bg-muted text-muted-foreground"
                )}
                title={`${timerLabel} ${timeElapsed.text} ago`}
              >
                <Clock className="h-3 w-3" />
                <span className="font-medium">{timeElapsed.text}</span>
              </div>
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

          {/* Footer with assign dropdown and metadata */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            {/* Assign dropdown - visible on card */}
            {showAssignDropdown && (
              <Popover>
                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {assignedUser ? (
                      <>
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={assignedUser.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">
                            {getUserInitials(assignedUser)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-[60px] truncate">
                          {assignedUser.full_name?.split(" ")[0] || assignedUser.email.split("@")[0]}
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3" />
                        Assign
                      </>
                    )}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                  <Command>
                    <CommandInput placeholder="Search users..." />
                    <CommandList>
                      <CommandEmpty>No users found</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={() => handleAssignTask(task.id, user.id)}
                            className="cursor-pointer"
                          >
                            <Avatar className="h-5 w-5 mr-2">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getUserInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm">{user.full_name || "Unnamed"}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            {/* Due date with alert */}
            {task.due_date && (
              <div className={cn(
                "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
                dueDateAlert.isOverdue && "bg-red-100 text-red-700 animate-pulse font-medium",
                dueDateAlert.isUrgent && !dueDateAlert.isOverdue && "bg-orange-100 text-orange-700 animate-pulse font-medium",
                dueDateAlert.isApproaching && !dueDateAlert.isUrgent && !dueDateAlert.isOverdue && "bg-amber-50 text-amber-700",
                !dueDateAlert.isOverdue && !dueDateAlert.isApproaching && "text-muted-foreground"
              )}>
                {dueDateAlert.isOverdue ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : dueDateAlert.isApproaching ? (
                  <Bell className="h-3 w-3" />
                ) : (
                  <Calendar className="h-3 w-3" />
                )}
                <span>{dueDateAlert.text || new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
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
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">TaskPool</h1>
                <p className="text-xs text-muted-foreground">
                  Categorize tasks and drag down to assign to team members
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
            <Button onClick={() => setShowCreateDialog(true)} className="h-9">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      {/* Alert Banner - shows when there are overdue or approaching tasks */}
      {showAlertBanner && tasksWithAlerts.length > 0 && (
        <div className={cn(
          "flex items-center justify-between px-6 py-2 text-sm",
          overdueCount > 0 ? "bg-red-50 border-b border-red-200" : "bg-amber-50 border-b border-amber-200"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-1.5 font-medium animate-pulse",
              overdueCount > 0 ? "text-red-700" : "text-amber-700"
            )}>
              <AlertTriangle className="h-4 w-4" />
              <span>
                {overdueCount > 0 && (
                  <>{overdueCount} overdue task{overdueCount !== 1 && "s"}</>
                )}
                {overdueCount > 0 && approachingCount > 0 && " and "}
                {approachingCount > 0 && (
                  <>{approachingCount} task{approachingCount !== 1 && "s"} due soon</>
                )}
              </span>
            </div>
            <div className="flex gap-1">
              {tasksWithAlerts.slice(0, 3).map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium truncate max-w-[150px] hover:opacity-80 transition-opacity",
                    getDueDateAlertStatus(t.due_date, t.alert_threshold_hours, t.alert_dismissed || false).isOverdue
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  )}
                >
                  {t.title}
                </button>
              ))}
              {tasksWithAlerts.length > 3 && (
                <span className="text-muted-foreground text-xs self-center">
                  +{tasksWithAlerts.length - 3} more
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowAlertBanner(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Board Area - Action Type Columns */}
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
          className="h-full overflow-x-auto p-4 pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
        >
          {loading ? (
            <div className="flex gap-4 h-full">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-72 flex-shrink-0 space-y-3">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4 h-full">
              {/* Action Type Columns */}
              {actionTypes.map((actionType) => {
                const Icon = getActionIcon(actionType.icon);
                const typeTasks = filterTasks(getTasksByActionType(actionType.id));
                const isDropTarget = dragOverColumn === actionType.id;

                return (
                  <div
                    key={actionType.id}
                    className={cn(
                      "w-72 flex-shrink-0 flex flex-col bg-card rounded-xl shadow-sm border overflow-hidden transition-all",
                      isDropTarget && "ring-2 ring-primary ring-offset-2 bg-primary/5"
                    )}
                  >
                    {/* Column Header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/30"
                      style={{ borderLeftWidth: '3px', borderLeftColor: actionType.color }}
                    >
                      <div
                        className="p-1 rounded"
                        style={{ backgroundColor: `${actionType.color}15` }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: actionType.color }} />
                      </div>
                      <span className="font-semibold text-sm text-foreground flex-1 truncate">
                        {actionType.label}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{ backgroundColor: `${actionType.color}15`, color: actionType.color }}
                      >
                        {typeTasks.length}
                      </Badge>
                    </div>

                    {/* Column Content - This is the drop zone */}
                    <div
                      data-column-content
                      data-column-id={actionType.id}
                      className={cn(
                        "flex-1 p-2 space-y-2 overflow-y-auto bg-muted/10 min-h-[200px]",
                        isDropTarget && "bg-primary/10"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverColumn(actionType.id);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverColumn(actionType.id);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX;
                        const y = e.clientY;
                        // Only clear if actually left the element bounds
                        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                          setDragOverColumn(null);
                        }
                      }}
                      onDrop={(e) => handleDrop(e, actionType.id, "action")}
                    >
                      {typeTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground pointer-events-none">
                          <Icon className="h-6 w-6 opacity-30 mb-2" style={{ color: actionType.color }} />
                          <p className="text-xs">Drop tasks here</p>
                        </div>
                      ) : (
                        typeTasks.map((task) => renderTaskCard(task))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom User Buckets - Fixed at bottom */}
      <div className="flex-shrink-0 bg-background border-t shadow-lg">
        <div className="px-4 py-1.5 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Drag tasks to assign
            </span>
            <Badge variant="secondary" className="text-xs ml-auto">
              {tasks.filter(t => t.assigned_to && t.status !== "completed").length} assigned
            </Badge>
          </div>
        </div>
        <div className="p-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {users.map((user) => {
              const userTasks = getTasksByUser(user.id);
              const isDropTarget = dragOverColumn === `user-${user.id}`;
              const nameParts = (user.full_name || user.email.split("@")[0]).split(" ");
              const firstName = nameParts[0] || "";
              const lastName = nameParts.slice(1).join(" ") || "";

              return (
                <div
                  key={user.id}
                  data-user-bucket={user.id}
                  className={cn(
                    "flex-shrink-0 w-20 h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center text-center",
                    isDropTarget
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 scale-110 shadow-lg border-solid"
                      : "border-border border-dashed bg-card hover:border-muted-foreground/50 hover:bg-muted/30",
                    draggedTask && "cursor-copy"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "copy";
                    setDragOverColumn(`user-${user.id}`);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverColumn(`user-${user.id}`);
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
                  onDrop={(e) => handleDrop(e, user.id, "user")}
                >
                  <p className="text-xs font-semibold truncate w-full px-1 leading-tight pointer-events-none">
                    {firstName}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground truncate w-full px-1 leading-tight pointer-events-none">
                    {lastName || <span className="invisible">.</span>}
                  </p>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[9px] px-1 py-0 mt-0.5 h-4 min-w-[20px] pointer-events-none",
                      userTasks.length > 0 ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {userTasks.length}
                  </Badge>
                </div>
              );
            })}

            {users.length === 0 && (
              <div className="flex items-center justify-center py-3 px-8 text-muted-foreground">
                <Users className="h-5 w-5 mr-2 opacity-50" />
                <span className="text-sm">No team members in TaskPool ribbon</span>
              </div>
            )}
          </div>
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
