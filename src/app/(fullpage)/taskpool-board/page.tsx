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
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: userId }),
      });

      if (response.ok) {
        const user = users.find(u => u.id === userId);
        toast.success(`Task assigned to ${user?.full_name || user?.email || "user"}`);
        loadTasks(false);
      } else {
        toast.error("Failed to assign task");
      }
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task");
    }
  };

  const handleChangeActionType = async (taskId: string, actionTypeId: string) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type_id: actionTypeId }),
      });

      if (response.ok) {
        toast.success("Task moved");
        loadTasks(false);
      } else {
        toast.error("Failed to move task");
      }
    } catch (error) {
      console.error("Error moving task:", error);
      toast.error("Failed to move task");
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.stopPropagation();
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    // Add a slight delay to allow the drag image to be set
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
    // Only clear if leaving the actual drop zone, not a child element
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, columnId: string, columnType: "action" | "user") => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);

    if (!draggedTask) {
      console.log("No dragged task found");
      return;
    }

    console.log("Dropping task", draggedTask.id, "to", columnId, columnType);

    if (columnType === "action") {
      // Moving to action type column
      if (draggedTask.action_type_id !== columnId) {
        await handleChangeActionType(draggedTask.id, columnId);
      }
    } else if (columnType === "user") {
      // Assigning to user
      if (draggedTask.assigned_to !== columnId) {
        await handleAssignTask(draggedTask.id, columnId);
      }
    }

    setDraggedTask(null);
  };

  // Group tasks
  const getUnassignedTasks = () => tasks.filter(t => !t.assigned_to && t.status !== "completed");
  const getTasksByActionType = (actionTypeId: string) =>
    getUnassignedTasks().filter(t => t.action_type_id === actionTypeId);
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
          // Prevent click when starting drag
          e.currentTarget.dataset.dragging = "false";
        }}
        onMouseMove={(e) => {
          // Mark as dragging if mouse moves while button is down
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
          // Only open modal if not dragging
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
            </div>

            {/* Drag handle */}
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

            {/* Due date */}
            {task.due_date && (
              <span className={cn(
                "text-[10px] flex items-center gap-0.5",
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
                      isDropTarget && "ring-2 ring-primary ring-offset-2"
                    )}
                    onDragOver={(e) => handleDragOver(e, actionType.id)}
                    onDragEnter={(e) => handleDragEnter(e, actionType.id)}
                    onDragLeave={(e) => handleDragLeave(e)}
                    onDrop={(e) => handleDrop(e, actionType.id, "action")}
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

                    {/* Column Content */}
                    <div
                      data-column-content
                      className="flex-1 p-2 space-y-2 overflow-y-auto bg-muted/10"
                    >
                      {typeTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
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
        <div className="px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Drag tasks here to assign
            </span>
            <Badge variant="secondary" className="text-xs ml-auto">
              {tasks.filter(t => t.assigned_to && t.status !== "completed").length} assigned
            </Badge>
          </div>
        </div>
        <div className="p-3 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {users.map((user) => {
              const userTasks = getTasksByUser(user.id);
              const isDropTarget = dragOverColumn === `user-${user.id}`;

              return (
                <div
                  key={user.id}
                  className={cn(
                    "flex-shrink-0 w-48 rounded-lg border-2 border-dashed transition-all",
                    isDropTarget
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 scale-105 shadow-lg"
                      : "border-border bg-card hover:border-muted-foreground/30",
                    draggedTask && "cursor-copy"
                  )}
                  onDragOver={(e) => handleDragOver(e, `user-${user.id}`)}
                  onDragEnter={(e) => handleDragEnter(e, `user-${user.id}`)}
                  onDragLeave={(e) => handleDragLeave(e)}
                  onDrop={(e) => handleDrop(e, user.id, "user")}
                >
                  <div className="p-3 flex items-center gap-3">
                    <Avatar className={cn(
                      "h-10 w-10 ring-2 ring-offset-2 transition-all",
                      isDropTarget ? "ring-blue-500" : "ring-transparent"
                    )}>
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-sm font-medium">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.full_name || user.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {userTasks.length} task{userTasks.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {users.length === 0 && (
              <div className="flex items-center justify-center py-4 px-8 text-muted-foreground">
                <Users className="h-5 w-5 mr-2 opacity-50" />
                <span className="text-sm">No team members available</span>
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
