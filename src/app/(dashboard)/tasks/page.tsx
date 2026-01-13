"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/supabase/auth-context";
import { useTaskContext, Task, TaskView } from "@/lib/tasks/task-context";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  Search,
  Eye,
  Trash2,
  MoreHorizontal,
  Phone,
  Mail,
  FileText,
  Loader2,
  RefreshCw,
  ArrowRight,
  UserPlus,
  LayoutList,
  Hand,
  UserCheck,
  User,
  AlertCircle,
  Plus,
  X,
  Pencil,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// Types
interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface CustomColumn {
  id: string;
  name: string;
  color: string;
  taskIds: string[];
}

// Column colors for custom columns
const columnColors = [
  { name: "purple", class: "bg-purple-400", header: "bg-purple-50 border-purple-200" },
  { name: "pink", class: "bg-pink-400", header: "bg-pink-50 border-pink-200" },
  { name: "indigo", class: "bg-indigo-400", header: "bg-indigo-50 border-indigo-200" },
  { name: "teal", class: "bg-teal-400", header: "bg-teal-50 border-teal-200" },
  { name: "orange", class: "bg-orange-400", header: "bg-orange-50 border-orange-200" },
  { name: "cyan", class: "bg-cyan-400", header: "bg-cyan-50 border-cyan-200" },
];

// Config
const statusConfig = {
  pending: {
    label: "To Do",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
    headerBg: "bg-yellow-50 border-yellow-200",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    headerBg: "bg-blue-50 border-blue-200",
  },
  completed: {
    label: "Done",
    className: "bg-green-100 text-green-700 border-green-200",
    headerBg: "bg-green-50 border-green-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-700 border-gray-200",
    headerBg: "bg-gray-50 border-gray-200",
  },
};

const priorityConfig = {
  low: { label: "Low", className: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-600", dot: "bg-blue-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-600", dot: "bg-orange-400" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-600", dot: "bg-red-400" },
};

const sourceIcons = {
  phone_call: Phone,
  email: Mail,
  document_intake: FileText,
  manual: ClipboardList,
};

const KANBAN_STATUSES: Array<keyof typeof statusConfig> = ["pending", "in_progress", "completed"];

export default function TasksPage() {
  const { user } = useAuth();
  const {
    loading,
    currentView,
    setCurrentView,
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    refreshTasks,
    updateTaskStatus,
    claimTask,
    assignTask,
    myTasks,
    allTasks,
    taskCounts,
  } = useTaskContext();

  // Team members for reassignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Drag state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Custom columns state
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("task-custom-columns");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState(columnColors[0].class);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");

  // Persist custom columns to localStorage
  const saveCustomColumns = useCallback((columns: CustomColumn[]) => {
    setCustomColumns(columns);
    if (typeof window !== "undefined") {
      localStorage.setItem("task-custom-columns", JSON.stringify(columns));
    }
  }, []);

  // Add new custom column
  const handleAddColumn = useCallback(() => {
    if (!newColumnName.trim()) return;
    const newColumn: CustomColumn = {
      id: `col-${Date.now()}`,
      name: newColumnName.trim(),
      color: newColumnColor,
      taskIds: [],
    };
    saveCustomColumns([...customColumns, newColumn]);
    setNewColumnName("");
    setNewColumnColor(columnColors[0].class);
    setIsAddingColumn(false);
    toast.success(`Column "${newColumn.name}" created`);
  }, [newColumnName, newColumnColor, customColumns, saveCustomColumns]);

  // Delete custom column
  const handleDeleteColumn = useCallback((columnId: string) => {
    const column = customColumns.find((c) => c.id === columnId);
    saveCustomColumns(customColumns.filter((c) => c.id !== columnId));
    toast.success(`Column "${column?.name}" deleted`);
  }, [customColumns, saveCustomColumns]);

  // Rename custom column
  const handleRenameColumn = useCallback((columnId: string, newName: string) => {
    if (!newName.trim()) return;
    saveCustomColumns(
      customColumns.map((c) =>
        c.id === columnId ? { ...c, name: newName.trim() } : c
      )
    );
    setEditingColumnId(null);
    setEditingColumnName("");
  }, [customColumns, saveCustomColumns]);

  // Move task to custom column
  const handleMoveToCustomColumn = useCallback((columnId: string, taskId: string) => {
    saveCustomColumns(
      customColumns.map((c) => {
        // Remove from all custom columns first
        const filtered = c.taskIds.filter((id) => id !== taskId);
        // Add to target column
        if (c.id === columnId) {
          return { ...c, taskIds: [...filtered, taskId] };
        }
        return { ...c, taskIds: filtered };
      })
    );
  }, [customColumns, saveCustomColumns]);

  // Remove task from all custom columns (when moved back to status column)
  const handleRemoveFromCustomColumns = useCallback((taskId: string) => {
    saveCustomColumns(
      customColumns.map((c) => ({
        ...c,
        taskIds: c.taskIds.filter((id) => id !== taskId),
      }))
    );
  }, [customColumns, saveCustomColumns]);

  // Get tasks in custom column
  const getTasksInCustomColumn = useCallback((columnId: string) => {
    const column = customColumns.find((c) => c.id === columnId);
    if (!column) return [];
    const tasks = getTasksForView();
    return tasks.filter((t) => column.taskIds.includes(t.id));
  }, [customColumns]);

  // Fetch team members for reassignment
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/users/team");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.users || []);
      } else {
        console.error("Failed to fetch team members:", response.status);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  }, []);

  // Get tasks for current view
  const getTasksForView = () => {
    switch (currentView) {
      case "my-work":
        return myTasks;
      case "all":
        return allTasks;
      default:
        return myTasks;
    }
  };

  // Filter tasks by status
  const getTasksByStatus = (status: string) => {
    const tasks = getTasksForView();
    return tasks.filter((task) => task.status === status);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    const success = await updateTaskStatus(draggedTask.id, newStatus as Task["status"]);
    if (success) {
      toast.success(`Moved to ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`);
    } else {
      toast.error("Failed to update task");
    }

    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // Handle claiming a task from the pool
  const handleClaimTask = async (task: Task) => {
    const success = await claimTask(task.id);
    if (success) {
      toast.success("Task claimed! It's now in your work queue.");
    } else {
      toast.error("Failed to claim task");
    }
  };

  // Handle task reassignment
  const handleReassignTask = async (newAssigneeId: string, newAssigneeName: string) => {
    if (!selectedTask) return;

    const success = await assignTask(selectedTask.id, newAssigneeId);
    if (success) {
      toast.success(`Task assigned to ${newAssigneeName}`);
      setReassignDialogOpen(false);
      setSelectedTask(null);
    } else {
      toast.error("Failed to assign task");
    }
  };

  // Handle task deletion
  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Task deleted");
        setDeleteDialogOpen(false);
        setSelectedTask(null);
        refreshTasks();
      } else {
        toast.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  // Quick status change
  const handleQuickStatusChange = async (task: Task, newStatus: string) => {
    const success = await updateTaskStatus(task.id, newStatus as Task["status"]);
    if (success) {
      toast.success("Status updated");
    } else {
      toast.error("Failed to update task");
    }
  };

  // Task card component - using div-based structure for reliable text containment
  const TaskCard = ({ task, showClaimButton = false }: { task: Task; showClaimButton?: boolean }) => {
    const SourceIcon = sourceIcons[task.source_type as keyof typeof sourceIcons] || ClipboardList;
    const isTestTask = task.source_email_id?.startsWith("test_");

    // Extract caller/sender info from source_metadata or ai_extracted_data
    const getContactInfo = () => {
      // If we have a matched client, use that
      if (task.client) {
        return {
          name: `${task.client.first_name} ${task.client.last_name}`,
          detail: task.client.phone || task.client.email || null,
          isMatched: true,
        };
      }

      // For phone calls, check source_metadata
      if (task.source_type === "phone_call" && task.source_metadata) {
        const callerName = task.source_metadata.caller_name;
        const callerPhone = task.source_metadata.caller_phone;
        if (callerName || callerPhone) {
          return {
            name: callerName || null,
            detail: callerPhone || null,
            isMatched: false,
          };
        }
      }

      // For emails, check ai_extracted_data
      if (task.source_type === "email" && task.ai_extracted_data?.client_match) {
        const match = task.ai_extracted_data.client_match;
        return {
          name: match.name || match.company || null,
          detail: match.email || null,
          isMatched: false,
        };
      }

      return null;
    };

    const contactInfo = getContactInfo();

    // Handle card click to open details (but not when clicking dropdown)
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't open modal if clicking on dropdown trigger or its contents
      const target = e.target as HTMLElement;
      if (target.closest('[data-radix-collection-item]') ||
          target.closest('button') ||
          target.closest('[role="menu"]')) {
        return;
      }
      setSelectedTask(task);
      setViewDialogOpen(true);
    };

    return (
      <div
        data-task-card
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        className={cn(
          "bg-card rounded-lg border shadow-sm p-3 transition-all hover:shadow-md w-full cursor-grab active:cursor-grabbing",
          draggedTask?.id === task.id && "opacity-50 ring-2 ring-primary",
          isTestTask && "border-amber-200 bg-amber-50/30"
        )}
        style={{
          overflow: 'hidden',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          contain: 'inline-size'
        }}
      >
        {/* Source breadcrumb */}
        {task.source_type && task.source_type !== "manual" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 pb-2 border-b border-dashed">
            <SourceIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Created from {task.source_type.replace(/_/g, " ")}</span>
            {task.created_at && (
              <>
                <span className="flex-shrink-0">•</span>
                <span className="flex-shrink-0">{format(new Date(task.created_at), "MMM d, h:mm a")}</span>
              </>
            )}
          </div>
        )}

        {/* Contact info - caller/sender */}
        {contactInfo && (contactInfo.name || contactInfo.detail) && (
          <div className={cn(
            "flex items-center gap-2 text-xs mb-2 p-2 rounded-md",
            contactInfo.isMatched ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"
          )}>
            <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0 truncate">
              {contactInfo.name && (
                <span className="font-medium">{contactInfo.name}</span>
              )}
              {contactInfo.name && contactInfo.detail && (
                <span className="text-muted-foreground mx-1">•</span>
              )}
              {contactInfo.detail && (
                <span className="text-muted-foreground">{contactInfo.detail}</span>
              )}
            </div>
            {contactInfo.isMatched && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-100 text-green-700 border-green-300 flex-shrink-0">
                Matched
              </Badge>
            )}
          </div>
        )}

        {/* Unknown caller warning */}
        {task.source_type === "phone_call" && !contactInfo && (
          <div className="flex items-center gap-2 text-xs mb-2 p-2 rounded-md bg-amber-50 border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
            <span className="text-amber-700">Unknown caller - needs identification</span>
          </div>
        )}

        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", priorityConfig[task.priority]?.dot)} />
            <span className="font-medium text-sm truncate block" style={{ maxWidth: 'calc(100% - 16px)' }}>{task.title}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedTask(task);
                  setViewDialogOpen(true);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedTask(task);
                  fetchTeamMembers();
                  setReassignDialogOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Assign to Someone
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {task.status !== "completed" && (
                <DropdownMenuItem onClick={() => handleQuickStatusChange(task, "completed")}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Complete
                </DropdownMenuItem>
              )}
              {task.status === "completed" && (
                <DropdownMenuItem onClick={() => handleQuickStatusChange(task, "in_progress")}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Reopen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setSelectedTask(task);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description - truncated in JS for guaranteed containment */}
        {task.description && (
          <div
            className="bg-muted/50 rounded-lg p-2 mb-2"
            style={{
              overflow: 'hidden',
              maxHeight: '52px'
            }}
          >
            <p className="text-xs text-muted-foreground">
              {task.description.length > 120
                ? task.description.substring(0, 120) + '...'
                : task.description}
            </p>
          </div>
        )}

        {/* Tags */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          {task.priority === "urgent" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">
              Urgent
            </Badge>
          )}
          {task.priority === "high" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">
              High
            </Badge>
          )}
          {task.client && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {task.client.first_name} {task.client.last_name}
            </Badge>
          )}
          {isTestTask && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
              Test
            </Badge>
          )}
        </div>

        {/* Claim button for unclaimed tasks in All Tasks view */}
        {showClaimButton && (
          <div className="mt-3 pt-2 border-t">
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => handleClaimTask(task)}
            >
              <Hand className="h-3 w-3 mr-1.5" />
              Claim This Task
            </Button>
          </div>
        )}

        {/* Due date */}
        {task.due_date && !showClaimButton && (
          <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className={cn(
              new Date(task.due_date) < new Date() && task.status !== "completed"
                ? "text-red-600 font-medium"
                : "text-muted-foreground"
            )}>
              {format(new Date(task.due_date), "MMM d")}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Stats for current view
  const currentTasks = getTasksForView();
  const todoCount = currentTasks.filter((t) => t.status === "pending").length;
  const inProgressCount = currentTasks.filter((t) => t.status === "in_progress").length;
  const doneCount = currentTasks.filter((t) => t.status === "completed").length;

  return (
    <>
      <Header title="Tasks" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar with Tabs */}
        <div className="border-b bg-card flex-shrink-0">
          {/* Tabs Row */}
          <div className="h-12 flex items-center px-4 gap-4 border-b">
            <Tabs value={currentView} onValueChange={(v) => setCurrentView(v as TaskView)}>
              <TabsList className="h-9">
                <TabsTrigger value="my-work" className="gap-2 px-3">
                  <UserCheck className="h-4 w-4" />
                  My Tasks
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {taskCounts.myWork}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-2 px-3">
                  <LayoutList className="h-4 w-4" />
                  All Tasks (Org)
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {taskCounts.all}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex-1" />

            {/* Refresh */}
            <Button variant="ghost" size="sm" className="h-8" onClick={() => refreshTasks()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Filters Row */}
          <div className="h-12 flex items-center px-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] h-8 pl-9 text-sm"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {/* Stats */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-muted-foreground">{todoCount} to do</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-muted-foreground">{inProgressCount} in progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-muted-foreground">{doneCount} done</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 bg-background">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : currentTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              {currentView === "my-work" ? (
                <>
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No tasks assigned to you</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Tasks will appear here when assigned to you from calls, emails, or manually.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setCurrentView("all")}
                  >
                    <LayoutList className="h-4 w-4 mr-2" />
                    View All Tasks
                  </Button>
                </>
              ) : (
                <>
                  <LayoutList className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No tasks found</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Tasks will appear here as they are created from calls, emails, or manually.
                  </p>
                </>
              )}
            </div>
          ) : (
            // Kanban board for all views
            <div
              className="flex gap-4 h-full overflow-x-auto pb-4"
              style={{ minWidth: 0 }}
            >
              {/* Status Columns */}
              {KANBAN_STATUSES.map((status) => {
                const statusTasks = getTasksByStatus(status);
                const config = statusConfig[status];

                return (
                  <div
                    key={status}
                    className={cn(
                      "flex flex-col rounded-lg bg-muted/30 transition-colors flex-shrink-0",
                      dragOverColumn === status && "bg-primary/10"
                    )}
                    style={{
                      width: '320px',
                      minWidth: '320px',
                      maxWidth: '320px',
                    }}
                    onDragOver={(e) => handleDragOver(e, status)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    <div className="p-3 border-b bg-card rounded-t-lg flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          status === "pending" && "bg-yellow-400",
                          status === "in_progress" && "bg-blue-400",
                          status === "completed" && "bg-green-400"
                        )} />
                        <h3 className="font-medium text-sm">{config.label}</h3>
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          {statusTasks.length}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                      <div className="p-2 space-y-2 min-h-[200px]">
                        {statusTasks.length === 0 ? (
                          <div className={cn(
                            "flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg transition-colors",
                            dragOverColumn === status && "border-primary bg-primary/5"
                          )}>
                            <p className="text-xs text-muted-foreground">
                              Drop tasks here
                            </p>
                          </div>
                        ) : (
                          statusTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              showClaimButton={
                                currentView === "all" &&
                                !task.assigned_to &&
                                !task.claimed_by
                              }
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Custom Columns */}
              {customColumns.map((column) => {
                const columnTasks = getTasksInCustomColumn(column.id);
                const colorConfig = columnColors.find(c => c.class === column.color) || columnColors[0];

                return (
                  <div
                    key={column.id}
                    className={cn(
                      "flex flex-col rounded-lg bg-muted/30 transition-colors flex-shrink-0",
                      dragOverColumn === column.id && "bg-primary/10"
                    )}
                    style={{
                      width: '320px',
                      minWidth: '320px',
                      maxWidth: '320px',
                    }}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverColumn(null);
                      if (draggedTask) {
                        handleMoveToCustomColumn(column.id, draggedTask.id);
                        toast.success(`Moved to ${column.name}`);
                        setDraggedTask(null);
                      }
                    }}
                  >
                    <div className={cn("p-3 border-b rounded-t-lg flex-shrink-0", colorConfig.header)}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", column.color)} />
                        {editingColumnId === column.id ? (
                          <Input
                            value={editingColumnName}
                            onChange={(e) => setEditingColumnName(e.target.value)}
                            onBlur={() => {
                              handleRenameColumn(column.id, editingColumnName);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleRenameColumn(column.id, editingColumnName);
                              } else if (e.key === "Escape") {
                                setEditingColumnId(null);
                                setEditingColumnName("");
                              }
                            }}
                            className="h-6 text-sm font-medium px-1"
                            autoFocus
                          />
                        ) : (
                          <h3 className="font-medium text-sm">{column.name}</h3>
                        )}
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          {columnTasks.length}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingColumnId(column.id);
                                setEditingColumnName(column.name);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteColumn(column.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Column
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                      <div className="p-2 space-y-2 min-h-[200px]">
                        {columnTasks.length === 0 ? (
                          <div className={cn(
                            "flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg transition-colors",
                            dragOverColumn === column.id && "border-primary bg-primary/5"
                          )}>
                            <p className="text-xs text-muted-foreground">
                              Drop tasks here
                            </p>
                          </div>
                        ) : (
                          columnTasks.map((task) => (
                            <TaskCard key={task.id} task={task} />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Column Button */}
              <div className="flex-shrink-0" style={{ width: '280px', minWidth: '280px' }}>
                {isAddingColumn ? (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <Input
                      placeholder="Column name..."
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddColumn();
                        if (e.key === "Escape") setIsAddingColumn(false);
                      }}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Color:</span>
                      {columnColors.map((color) => (
                        <button
                          key={color.name}
                          onClick={() => setNewColumnColor(color.class)}
                          className={cn(
                            "w-5 h-5 rounded-full transition-all",
                            color.class,
                            newColumnColor === color.class && "ring-2 ring-offset-2 ring-primary"
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsAddingColumn(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleAddColumn}
                        disabled={!newColumnName.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingColumn(true)}
                    className="w-full h-full min-h-[200px] rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/20 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-sm font-medium">Add Column</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Task Detail Panel (Slide-out Sheet with Subtasks and Activity) */}
      <TaskDetailPanel
        task={selectedTask}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onTaskUpdate={refreshTasks}
      />

      {/* Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a team member to assign this task to.
            </p>
            <div className="space-y-2">
              {teamMembers
                .filter((m) => m.id !== user?.id)
                .map((member) => (
                  <Button
                    key={member.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleReassignTask(member.id, member.full_name || member.email)}
                  >
                    <Avatar className="h-6 w-6 mr-2">
                      <AvatarFallback className="text-xs">
                        {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{member.full_name || member.email}</span>
                    <span className="ml-auto text-xs text-muted-foreground capitalize">
                      {member.role}
                    </span>
                  </Button>
                ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTask}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
