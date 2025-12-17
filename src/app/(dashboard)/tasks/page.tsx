"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/supabase/auth-context";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Plus,
  Eye,
  Trash2,
  MoreHorizontal,
  Phone,
  Mail,
  FileText,
  Loader2,
  RefreshCw,
  GripVertical,
  ArrowRight,
  UserPlus,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

// Types
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  source_type: "phone_call" | "email" | "document_intake" | "manual" | null;
  source_email_id: string | null;
  client_id: string | null;
  assigned_to: string | null;
  claimed_by: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

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

export default function MyTasksPage() {
  // Get current user from auth context
  const { user } = useAuth();

  // Task state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Team members for reassignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Drag state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch user's tasks
  const fetchTasks = useCallback(async () => {
    if (!user?.id) {
      console.log("[MyTasks] No user id yet, skipping fetch");
      return;
    }

    console.log("[MyTasks] Fetching tasks for user:", user.id, user.email);

    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        console.log("[MyTasks] Fetched", data.tasks?.length || 0, "total tasks");

        // Filter to only show tasks assigned to current user
        const myTasks = (data.tasks || []).filter(
          (task: Task) => task.assigned_to === user.id
        );
        console.log("[MyTasks] Found", myTasks.length, "tasks assigned to me");

        // Log task IDs and assignees for debugging
        if (data.tasks?.length > 0) {
          data.tasks.slice(0, 5).forEach((task: Task) => {
            console.log("[MyTasks] Task:", task.id.slice(0, 8), "assigned_to:", task.assigned_to, "title:", task.title?.slice(0, 30));
          });
        }

        setTasks(myTasks);
      } else {
        console.error("[MyTasks] Failed to fetch tasks:", response.status);
      }
    } catch (error) {
      console.error("[MyTasks] Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [user?.id, searchQuery]);

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

  useEffect(() => {
    if (user?.id) {
      fetchTasks();
      fetchTeamMembers();
    }
  }, [user?.id, fetchTasks, fetchTeamMembers]);

  // Filter tasks by status and other filters
  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => {
      if (task.status !== status) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      return true;
    });
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

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggedTask.id ? { ...t, status: newStatus as Task["status"] } : t
      )
    );

    try {
      const response = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "completed" && { completed_at: new Date().toISOString() }),
        }),
      });

      if (response.ok) {
        toast.success(`Moved to ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`);
      } else {
        // Revert on error
        fetchTasks();
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      fetchTasks();
      toast.error("Failed to update task");
    }

    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // Handle task reassignment
  const handleReassignTask = async (newAssigneeId: string, newAssigneeName: string) => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_to: newAssigneeId,
        }),
      });

      if (response.ok) {
        toast.success(`Task passed to ${newAssigneeName}`);
        setReassignDialogOpen(false);
        setSelectedTask(null);
        fetchTasks(); // Refresh to remove from current user's board
      } else {
        toast.error("Failed to reassign task");
      }
    } catch (error) {
      console.error("Error reassigning task:", error);
      toast.error("Failed to reassign task");
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
        fetchTasks();
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
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "completed" && { completed_at: new Date().toISOString() }),
        }),
      });

      if (response.ok) {
        toast.success(`Status updated`);
        fetchTasks();
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  // Task card component - matching Phone Agent card styling
  const TaskCard = ({ task }: { task: Task }) => {
    const SourceIcon = sourceIcons[task.source_type as keyof typeof sourceIcons] || ClipboardList;
    const isTestTask = task.source_email_id?.startsWith("test_");

    return (
      <Card
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        className={cn(
          "cursor-grab active:cursor-grabbing transition-all border-border/50 hover:shadow-md",
          draggedTask?.id === task.id && "opacity-50 ring-2 ring-primary",
          isTestTask && "border-amber-200 bg-amber-50/30"
        )}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", priorityConfig[task.priority]?.dot)} />
              <span className="font-medium text-sm truncate">{task.title}</span>
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
                    setReassignDialogOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Pass to Someone
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

          {task.description && (
            <div className="bg-muted/50 rounded-lg p-2 mb-2">
              <p className="text-xs text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            </div>
          )}

          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              <SourceIcon className="h-3 w-3 mr-1" />
              {(task.source_type || "manual").replace(/_/g, " ")}
            </Badge>
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
            {isTestTask && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
                Test
              </Badge>
            )}
          </div>

          {task.due_date && (
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
        </CardContent>
      </Card>
    );
  };

  // Stats
  const totalTasks = tasks.length;
  const todoCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <>
      <Header title="My Tasks" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <span className="font-medium">My Tasks</span>
          </div>

          {/* Search */}
          <div className="relative ml-4">
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

          {/* Stats in Top Bar */}
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

          <div className="h-4 border-l mx-2" />

          <span className="text-sm text-muted-foreground">{totalTasks} total</span>

          {/* Refresh */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchTasks()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-auto p-4 bg-background">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No tasks assigned to you</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                When tasks are assigned to you from the Task Table, they will appear here in your personal Kanban board.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
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
                    onDragOver={(e) => handleDragOver(e, status)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    <div className="p-3 border-b bg-card rounded-t-lg">
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

                    <ScrollArea className="flex-1">
                      <div className="p-2 space-y-2 min-h-[200px]">
                        {statusTasks.length === 0 ? (
                          <div className={cn(
                            "flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg transition-colors",
                            dragOverColumn === status && "border-primary bg-primary/5"
                          )}>
                            <p className="text-xs text-muted-foreground">Drop tasks here</p>
                          </div>
                        ) : (
                          statusTasks.map((task) => (
                            <TaskCard key={task.id} task={task} />
                          ))
                        )}
                      </div>
                    </ScrollArea>
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
                  <p>{selectedTask.client_id ? selectedTask.client_id.slice(0, 8) + "..." : "-"}</p>
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
                  setReassignDialogOpen(true);
                }
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Pass to Someone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Pass Task to Another User</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a team member to pass this task to. The task will be removed from your board and assigned to them.
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
