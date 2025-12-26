"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  Mail,
  FileText,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  Activity,
  User,
  Calendar,
  Building2,
  MoreHorizontal,
  Send,
  Loader2,
  ChevronRight,
  AlertCircle,
  Link2,
} from "lucide-react";
import { cn, safeFormatDistanceToNow, safeFormatDate } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Task } from "@/lib/tasks/task-context";

// Types
interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  position: number;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string | null;
  action: string;
  description: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface TaskDetailPanelProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate?: () => void;
}

const statusConfig = {
  pending: { label: "To Do", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "Done", className: "bg-green-100 text-green-700 border-green-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

const priorityConfig = {
  low: { label: "Low", className: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-600" },
  high: { label: "High", className: "bg-orange-100 text-orange-600" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-600" },
};

const actionIcons: Record<string, React.ReactNode> = {
  created: <Plus className="h-3.5 w-3.5" />,
  updated: <Activity className="h-3.5 w-3.5" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  assigned: <User className="h-3.5 w-3.5" />,
  subtask_added: <Plus className="h-3.5 w-3.5 text-blue-500" />,
  subtask_completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  subtask_uncompleted: <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />,
  subtask_deleted: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
  comment: <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
};

export function TaskDetailPanel({
  task,
  open,
  onOpenChange,
  onTaskUpdate,
}: TaskDetailPanelProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [activeTab, setActiveTab] = useState("subtasks");

  // Fetch subtasks and activity when task changes
  const fetchData = useCallback(async () => {
    if (!task) return;
    setLoading(true);

    try {
      const [subtasksRes, activityRes] = await Promise.all([
        fetch(`/api/tasks/${task.id}/subtasks`),
        fetch(`/api/tasks/${task.id}/activity`),
      ]);

      if (subtasksRes.ok) {
        const data = await subtasksRes.json();
        setSubtasks(data.subtasks || []);
      }

      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivity(data.activity || []);
      }
    } catch (error) {
      console.error("Error fetching task data:", error);
    } finally {
      setLoading(false);
    }
  }, [task]);

  useEffect(() => {
    if (open && task) {
      fetchData();
    }
  }, [open, task, fetchData]);

  // Add subtask
  const handleAddSubtask = async () => {
    if (!task || !newSubtaskTitle.trim()) return;
    setAddingSubtask(true);

    try {
      const response = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtaskTitle.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubtasks((prev) => [...prev, data.subtask]);
        setNewSubtaskTitle("");
        toast.success("Subtask added");
        fetchData(); // Refresh activity
      } else {
        toast.error("Failed to add subtask");
      }
    } catch (error) {
      console.error("Error adding subtask:", error);
      toast.error("Failed to add subtask");
    } finally {
      setAddingSubtask(false);
    }
  };

  // Toggle subtask completion
  const handleToggleSubtask = async (subtask: Subtask) => {
    try {
      const response = await fetch(
        `/api/tasks/${task?.id}/subtasks/${subtask.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: !subtask.is_completed }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSubtasks((prev) =>
          prev.map((s) => (s.id === subtask.id ? data.subtask : s))
        );
        fetchData(); // Refresh activity
      } else {
        toast.error("Failed to update subtask");
      }
    } catch (error) {
      console.error("Error updating subtask:", error);
      toast.error("Failed to update subtask");
    }
  };

  // Delete subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const response = await fetch(
        `/api/tasks/${task?.id}/subtasks/${subtaskId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
        toast.success("Subtask deleted");
        fetchData(); // Refresh activity
      } else {
        toast.error("Failed to delete subtask");
      }
    } catch (error) {
      console.error("Error deleting subtask:", error);
      toast.error("Failed to delete subtask");
    }
  };

  // Add comment
  const handleAddComment = async () => {
    if (!task || !newComment.trim()) return;
    setAddingComment(true);

    try {
      const response = await fetch(`/api/tasks/${task.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "comment",
          description: newComment.trim(),
        }),
      });

      if (response.ok) {
        setNewComment("");
        toast.success("Comment added");
        fetchData(); // Refresh activity
      } else {
        toast.error("Failed to add comment");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  };

  // Calculate progress
  const completedSubtasks = subtasks.filter((s) => s.is_completed).length;
  const totalSubtasks = subtasks.length;
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold line-clamp-2">
                {task.title}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={cn("text-xs", statusConfig[task.status]?.className)}
                >
                  {statusConfig[task.status]?.label}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", priorityConfig[task.priority]?.className)}
                >
                  {priorityConfig[task.priority]?.label}
                </Badge>
                {task.source_type && task.source_type !== "manual" && (
                  <Badge variant="outline" className="text-xs gap-1">
                    {task.source_type === "phone_call" && <Phone className="h-3 w-3" />}
                    {task.source_type === "email" && <Mail className="h-3 w-3" />}
                    {task.source_type === "document_intake" && <FileText className="h-3 w-3" />}
                    From {task.source_type.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Task Details Section */}
          <div className="p-4 border-b space-y-3 flex-shrink-0">
            {task.description && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                {task.description}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {task.client && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{task.client.first_name} {task.client.last_name}</span>
                </div>
              )}
              {task.due_date && safeFormatDate(task.due_date, "MMM d, yyyy") && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(
                    new Date(task.due_date) < new Date() && task.status !== "completed"
                      ? "text-red-600 font-medium"
                      : ""
                  )}>
                    Due {safeFormatDate(task.due_date, "MMM d, yyyy")}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Created {safeFormatDistanceToNow(task.created_at)} ago</span>
              </div>
            </div>

            {/* Subtasks Progress Bar */}
            {totalSubtasks > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {completedSubtasks}/{totalSubtasks} subtasks
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tabs for Subtasks and Activity */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="subtasks" className="flex-1 gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Subtasks
                {totalSubtasks > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {completedSubtasks}/{totalSubtasks}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1 gap-1.5">
                <Activity className="h-4 w-4" />
                Activity
                {activity.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {activity.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="subtasks" className="flex-1 overflow-hidden m-0 p-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : subtasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No subtasks yet</p>
                      <p className="text-xs">Add subtasks to break down this task</p>
                    </div>
                  ) : (
                    subtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors",
                          subtask.is_completed && "bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={subtask.is_completed}
                          onCheckedChange={() => handleToggleSubtask(subtask)}
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm",
                            subtask.is_completed && "line-through text-muted-foreground"
                          )}>
                            {subtask.title}
                          </p>
                          {subtask.completed_at && (
                            <p className="text-xs text-muted-foreground">
                              Completed {safeFormatDistanceToNow(subtask.completed_at)} ago
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteSubtask(subtask.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}

                  {/* Add subtask input */}
                  <div className="flex items-center gap-2 mt-4">
                    <Input
                      placeholder="Add a subtask..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddSubtask();
                        }
                      }}
                      disabled={addingSubtask}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddSubtask}
                      disabled={!newSubtaskTitle.trim() || addingSubtask}
                    >
                      {addingSubtask ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="activity" className="flex-1 overflow-hidden m-0 p-0 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : activity.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No activity yet</p>
                    </div>
                  ) : (
                    activity.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          {actionIcons[item.action] || <Activity className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {safeFormatDistanceToNow(item.created_at)} ago
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Add comment input */}
              <div className="p-4 border-t flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="flex-1 resize-none"
                  />
                  <Button
                    size="icon"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addingComment}
                    className="flex-shrink-0"
                  >
                    {addingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
