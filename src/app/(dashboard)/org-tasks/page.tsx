"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Hand,
  User,
  AlertCircle,
  Kanban,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/supabase/auth-context";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";

// Import Task type and context
import { Task, useTaskContext } from "@/lib/tasks/task-context";

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
    dot: "bg-yellow-400",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-400",
  },
  completed: {
    label: "Done",
    className: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-400",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-700 border-gray-200",
    dot: "bg-gray-400",
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

export default function OrgTasksPage() {
  const { user } = useAuth();
  const { tasks: contextTasks, loading: tasksLoading, refreshTasks } = useTaskContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Filter for unassigned tasks from shared context
  const tasks = contextTasks.filter(t => !t.assigned_to && !t.claimed_by);
  const loading = tasksLoading;

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Drag state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Refresh tasks using shared context
  const fetchTasks = useCallback(async () => {
    try {
      await refreshTasks();
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    }
  }, [refreshTasks]);

  // Fetch team members for assignment
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/users/team");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.client?.first_name?.toLowerCase().includes(query) ||
        task.client?.last_name?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Priority filter
    if (priorityFilter !== "all" && task.priority !== priorityFilter) {
      return false;
    }

    return true;
  });

  // Get tasks by status
  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter((task) => task.status === status);
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

    try {
      const response = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await refreshTasks();
        toast.success(`Moved to ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`);
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }

    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // Claim task (assign to self)
  const handleClaimTask = async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: user?.id }),
      });

      if (response.ok) {
        // Refresh tasks - real-time subscription will also update
        await refreshTasks();
        toast.success("Task claimed! It's now in your My Tasks.");
      } else {
        toast.error("Failed to claim task");
      }
    } catch (error) {
      console.error("Error claiming task:", error);
      toast.error("Failed to claim task");
    }
  };

  // Assign task to someone
  const handleAssignTask = async (memberId: string, memberName: string) => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: memberId }),
      });

      if (response.ok) {
        // Refresh tasks - real-time subscription will also update
        await refreshTasks();
        toast.success(`Task assigned to ${memberName}`);
        setAssignDialogOpen(false);
        setSelectedTask(null);
      } else {
        toast.error("Failed to assign task");
      }
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task");
    }
  };

  // Quick status change
  const handleQuickStatusChange = async (task: Task, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await refreshTasks();
        toast.success("Status updated");
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  // Delete task
  const handleDeleteTask = async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (response.ok) {
        await refreshTasks();
        toast.success("Task deleted");
      } else {
        toast.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  // Task card component
  const TaskCard = ({ task }: { task: Task }) => {
    const SourceIcon = sourceIcons[task.source_type as keyof typeof sourceIcons] || ClipboardList;

    const getContactInfo = () => {
      if (task.client) {
        return {
          name: `${task.client.first_name} ${task.client.last_name}`,
          detail: task.client.phone || task.client.email || null,
          isMatched: true,
        };
      }
      return null;
    };

    const contactInfo = getContactInfo();

    const handleCardClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-radix-collection-item]") ||
        target.closest("button") ||
        target.closest('[role="menu"]')
      ) {
        return;
      }
      setSelectedTask(task);
      setViewDialogOpen(true);
    };

    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        className={cn(
          "bg-card rounded-lg border shadow-sm p-3 transition-all hover:shadow-md w-full cursor-grab active:cursor-grabbing",
          draggedTask?.id === task.id && "opacity-50 ring-2 ring-primary"
        )}
        style={{
          overflow: "hidden",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          contain: "inline-size",
        }}
      >
        {/* Source breadcrumb */}
        {task.source_type && task.source_type !== "manual" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 pb-2 border-b border-dashed">
            <SourceIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">From {task.source_type.replace(/_/g, " ")}</span>
            {task.created_at && (
              <>
                <span className="flex-shrink-0">•</span>
                <span className="flex-shrink-0">
                  {format(new Date(task.created_at), "MMM d, h:mm a")}
                </span>
              </>
            )}
          </div>
        )}

        {/* Contact info */}
        {contactInfo && (
          <div className="flex items-center gap-2 text-xs mb-2 p-2 rounded-md bg-green-50 border border-green-200">
            <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0 truncate">
              <span className="font-medium">{contactInfo.name}</span>
              {contactInfo.detail && (
                <>
                  <span className="text-muted-foreground mx-1">•</span>
                  <span className="text-muted-foreground">{contactInfo.detail}</span>
                </>
              )}
            </div>
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 bg-green-100 text-green-700 border-green-300 flex-shrink-0"
            >
              Client
            </Badge>
          </div>
        )}

        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                priorityConfig[task.priority]?.dot
              )}
            />
            <span
              className="font-medium text-sm truncate block"
              style={{ maxWidth: "calc(100% - 16px)" }}
            >
              {task.title}
            </span>
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
              <DropdownMenuItem onClick={() => handleClaimTask(task)}>
                <Hand className="h-4 w-4 mr-2" />
                Claim for Myself
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedTask(task);
                  fetchTeamMembers();
                  setAssignDialogOpen(true);
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
                onClick={() => handleDeleteTask(task)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {task.description && (
          <div
            className="bg-muted/50 rounded-lg p-2 mb-2"
            style={{ overflow: "hidden", maxHeight: "52px" }}
          >
            <p className="text-xs text-muted-foreground">
              {task.description.length > 120
                ? task.description.substring(0, 120) + "..."
                : task.description}
            </p>
          </div>
        )}

        {/* Tags */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          {task.priority === "urgent" && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200"
            >
              Urgent
            </Badge>
          )}
          {task.priority === "high" && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200"
            >
              High
            </Badge>
          )}
        </div>

        {/* Claim button */}
        <div className="mt-3 pt-2 border-t flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleClaimTask(task);
            }}
          >
            <Hand className="h-3 w-3 mr-1.5" />
            Claim
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTask(task);
              fetchTeamMembers();
              setAssignDialogOpen(true);
            }}
          >
            <UserPlus className="h-3 w-3 mr-1.5" />
            Assign
          </Button>
        </div>

        {/* Due date */}
        {task.due_date && (
          <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span
              className={cn(
                new Date(task.due_date) < new Date() && task.status !== "completed"
                  ? "text-red-600 font-medium"
                  : "text-muted-foreground"
              )}
            >
              Due {format(new Date(task.due_date), "MMM d")}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Stats
  const todoCount = filteredTasks.filter((t) => t.status === "open").length;
  const inProgressCount = filteredTasks.filter((t) => t.status === "in_progress").length;
  const doneCount = filteredTasks.filter((t) => t.status === "completed").length;

  return (
    <>
      <Header title="Org Tasks" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="border-b bg-card flex-shrink-0">
          <div className="h-12 flex items-center px-4 gap-4">
            {/* Title with icon */}
            <div className="flex items-center gap-2">
              <Kanban className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-sm">General Task Pool</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {tasks.length} unassigned
              </Badge>
            </div>

            <div className="flex-1" />

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

            {/* Refresh */}
            <Button variant="ghost" size="sm" className="h-8" onClick={fetchTasks}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

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
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Kanban className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No unassigned tasks</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Tasks added to the general pool from Org Feed will appear here. Anyone can claim or
                assign them.
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full w-full"
              style={{ minWidth: 0, maxWidth: "100%", overflow: "hidden" }}
            >
              {KANBAN_STATUSES.map((status) => {
                const statusTasks = getTasksByStatus(status);
                const config = statusConfig[status];

                return (
                  <div
                    key={status}
                    className={cn(
                      "flex flex-col rounded-lg bg-muted/30 transition-colors w-full",
                      dragOverColumn === status && "bg-primary/10"
                    )}
                    style={{
                      overflow: "hidden",
                      minWidth: 0,
                      maxWidth: "100%",
                      width: "100%",
                    }}
                    onDragOver={(e) => handleDragOver(e, status)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    <div className="p-3 border-b bg-card rounded-t-lg flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", config.dot)} />
                        <h3 className="font-medium text-sm">{config.label}</h3>
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          {statusTasks.length}
                        </Badge>
                      </div>
                    </div>

                    <div
                      className="flex-1 w-full"
                      style={{
                        overflowY: "auto",
                        overflowX: "hidden",
                        width: "100%",
                        maxWidth: "100%",
                      }}
                    >
                      <div
                        className="p-2 space-y-2 min-h-[200px] w-full"
                        style={{ maxWidth: "100%", width: "100%" }}
                      >
                        {statusTasks.length === 0 ? (
                          <div
                            className={cn(
                              "flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg transition-colors",
                              dragOverColumn === status && "border-primary bg-primary/5"
                            )}
                          >
                            <p className="text-xs text-muted-foreground">Drop tasks here</p>
                          </div>
                        ) : (
                          statusTasks.map((task) => <TaskCard key={task.id} task={task} />)
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

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onTaskUpdate={fetchTasks}
      />

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a team member to assign this task to.
            </p>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <Button
                  key={member.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleAssignTask(member.id, member.full_name || member.email)}
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
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
