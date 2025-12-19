"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/supabase/auth-context";
import { useTaskContext, Task, TaskView } from "@/lib/tasks/task-context";
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
  Inbox,
  LayoutList,
  Hand,
  UserCheck,
  ChevronDown,
  ChevronUp,
  User,
  AlertCircle,
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
    refreshTasks,
    updateTaskStatus,
    claimTask,
    assignTask,
    myTasks,
    teamPoolTasks,
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

  // Fetch team members for reassignment
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.users || []);
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
      case "team-pool":
        return teamPoolTasks;
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

    return (
      <div
        draggable={currentView !== "team-pool"}
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        className={cn(
          "bg-card rounded-lg border shadow-sm p-3 transition-all hover:shadow-md",
          currentView !== "team-pool" && "cursor-grab active:cursor-grabbing",
          draggedTask?.id === task.id && "opacity-50 ring-2 ring-primary",
          isTestTask && "border-amber-200 bg-amber-50/30"
        )}
        style={{ overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}
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

        {/* Description - with forced text containment */}
        {task.description && (
          <div
            className="bg-muted/50 rounded-lg p-2 mb-2"
            style={{ overflow: 'hidden', maxWidth: '100%' }}
          >
            <p
              className="text-xs text-muted-foreground"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                hyphens: 'auto'
              }}
            >
              {task.description}
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

        {/* Claim button for team pool view */}
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
                  My Work
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {taskCounts.myWork}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="team-pool" className="gap-2 px-3">
                  <Inbox className="h-4 w-4" />
                  Team Pool
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {taskCounts.teamPool}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-2 px-3">
                  <LayoutList className="h-4 w-4" />
                  All Tasks
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
                  <h3 className="text-lg font-medium">No tasks in your queue</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Check the Team Pool to claim tasks, or tasks will appear here when assigned to you.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setCurrentView("team-pool")}
                  >
                    <Inbox className="h-4 w-4 mr-2" />
                    View Team Pool
                  </Button>
                </>
              ) : currentView === "team-pool" ? (
                <>
                  <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Team pool is empty</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    No unclaimed tasks available. Tasks from phone calls and emails will appear here.
                  </p>
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
          ) : currentView === "team-pool" ? (
            // Team Pool: List format like email/phone views
            <div className="space-y-2">
              {currentTasks.map((task) => {
                const SourceIcon = sourceIcons[task.source_type as keyof typeof sourceIcons] || ClipboardList;
                return (
                  <Card key={task.id} className="hover:shadow-md transition-all overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-3 p-4">
                        {/* Priority indicator */}
                        <div className={cn(
                          "w-1 self-stretch rounded-full flex-shrink-0",
                          priorityConfig[task.priority]?.dot
                        )} />

                        {/* Source icon avatar */}
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback className={cn(
                            task.source_type === "phone_call" && "bg-green-100 text-green-700",
                            task.source_type === "email" && "bg-blue-100 text-blue-700",
                            task.source_type === "document_intake" && "bg-purple-100 text-purple-700",
                            (!task.source_type || task.source_type === "manual") && "bg-muted text-muted-foreground"
                          )}>
                            <SourceIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-medium text-sm line-clamp-1">{task.title}</h3>
                            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0" suppressHydrationWarning>
                              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Description */}
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {task.description}
                            </p>
                          )}

                          {/* Metadata row */}
                          <div className="flex items-center flex-wrap gap-2 text-xs">
                            {/* Source badge */}
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <SourceIcon className="h-3 w-3" />
                              {(task.source_type || "manual").replace(/_/g, " ")}
                            </Badge>

                            {/* Priority badge for high/urgent */}
                            {(task.priority === "urgent" || task.priority === "high") && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  task.priority === "urgent" && "bg-red-100 text-red-700 border-red-200",
                                  task.priority === "high" && "bg-orange-100 text-orange-700 border-orange-200"
                                )}
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {task.priority}
                              </Badge>
                            )}

                            {/* Client info */}
                            {task.client && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span>{task.client.first_name} {task.client.last_name}</span>
                                {task.client.phone && (
                                  <>
                                    <span>•</span>
                                    <span>{task.client.phone}</span>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Due date if set */}
                            {task.due_date && (
                              <div className={cn(
                                "flex items-center gap-1",
                                new Date(task.due_date) < new Date() ? "text-red-600" : "text-muted-foreground"
                              )}>
                                <Clock className="h-3 w-3" />
                                <span>Due {format(new Date(task.due_date), "MMM d")}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleClaimTask(task)}
                            className="h-8"
                          >
                            <Hand className="h-4 w-4 mr-1.5" />
                            Claim
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            // My Work & All: Kanban board
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full" style={{ minWidth: 0 }}>
              {KANBAN_STATUSES.map((status) => {
                const statusTasks = getTasksByStatus(status);
                const config = statusConfig[status];

                return (
                  <div
                    key={status}
                    className={cn(
                      "flex flex-col rounded-lg bg-muted/30 transition-colors",
                      dragOverColumn === status && "bg-primary/10"
                    )}
                    style={{ overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}
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
                      <div className="p-2 space-y-2 min-h-[200px]" style={{ maxWidth: '100%' }}>
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
                            <TaskCard key={task.id} task={task} />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* View Task Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              {/* Source breadcrumb in dialog */}
              {selectedTask.source_type && selectedTask.source_type !== "manual" && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                  {selectedTask.source_type === "phone_call" && <Phone className="h-4 w-4" />}
                  {selectedTask.source_type === "email" && <Mail className="h-4 w-4" />}
                  {selectedTask.source_type === "document_intake" && <FileText className="h-4 w-4" />}
                  <span>Created from {selectedTask.source_type.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    {format(new Date(selectedTask.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Task ID</Label>
                <p className="font-medium">#{selectedTask.id.slice(0, 8)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p className="font-medium">{selectedTask.title}</p>
              </div>
              {selectedTask.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={cn("font-normal", statusConfig[selectedTask.status]?.className)}
                    >
                      {statusConfig[selectedTask.status]?.label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <div className="mt-1">
                    <Badge
                      variant="secondary"
                      className={cn("font-normal", priorityConfig[selectedTask.priority]?.className)}
                    >
                      {priorityConfig[selectedTask.priority]?.label}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Client</Label>
                  <p>
                    {selectedTask.client
                      ? `${selectedTask.client.first_name} ${selectedTask.client.last_name}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Source</Label>
                  <p className="capitalize">{(selectedTask.source_type || "manual").replace(/_/g, " ")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p>{selectedTask.due_date ? format(new Date(selectedTask.due_date), "MMM d, yyyy") : "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{format(new Date(selectedTask.created_at), "MMM d, yyyy")}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setViewDialogOpen(false);
                if (selectedTask) {
                  fetchTeamMembers();
                  setReassignDialogOpen(true);
                }
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Assign to Someone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
