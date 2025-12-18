"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import {
  Hand,
  Undo2,
  Check,
  Clock,
  User,
  Building,
  MessageSquare,
  FileText,
  Activity,
  Send,
  ArrowRight,
  Calendar,
  AlertCircle,
  Sparkles,
  Trash2,
  Edit,
  UserPlus,
  X,
  ChevronDown,
  ListChecks,
  Plus,
  GripVertical,
  Loader2,
  ArrowRightLeft,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface ActionType {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
  icon: string;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  email?: string;
  phone?: string;
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
  // Handoff fields
  handoff_to: string | null;
  handoff_from: string | null;
  handoff_notes: string | null;
  handoff_at: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Note {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
}

interface TaskStep {
  id: string;
  task_id: string;
  step_number: number;
  description: string;
  assigned_to: string | null;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_user?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  completed_user?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

interface ActivityLog {
  id: string;
  action: string;
  details: Record<string, any>;
  performed_by: string;
  created_at: string;
}

interface HandoffHistory {
  id: string;
  notes: string | null;
  created_at: string;
  from_user: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  to_user: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface TaskDetailModalProps {
  task: Task;
  actionTypes: ActionType[];
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onClaim: (taskId: string) => void;
  onRelease: (taskId: string) => void;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const activityIcons: Record<string, React.ElementType> = {
  created: FileText,
  claimed: Hand,
  released: Undo2,
  completed: Check,
  updated: Edit,
  note_added: MessageSquare,
  routed: ArrowRight,
  assigned: UserPlus,
  unassigned: X,
  step_added: Plus,
  step_completed: Check,
  step_uncompleted: X,
  step_deleted: Trash2,
  handed_off: ArrowRightLeft,
  handoff_accepted: Check,
};

export function TaskDetailModal({
  task,
  actionTypes,
  open,
  onClose,
  onUpdate,
  onClaim,
  onRelease,
}: TaskDetailModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [routeToActionType, setRouteToActionType] = useState<string>("");
  const [routeTitle, setRouteTitle] = useState("");
  const [completing, setCompleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    due_date: task.due_date || "",
    alert_threshold_hours: task.alert_threshold_hours || 24,
    action_type_id: task.action_type_id,
  });

  // User assignment state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // AI suggested assignee state
  const [suggestedAssignee, setSuggestedAssignee] = useState<{
    userId: string;
    confidence: number;
    user: { id: string; full_name: string; email: string } | null;
  } | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  // Steps state
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [newStepDescription, setNewStepDescription] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [stepAssignPopover, setStepAssignPopover] = useState<string | null>(null);
  const [stepUserSearch, setStepUserSearch] = useState("");

  // Handoff state
  const [showHandoffDialog, setShowHandoffDialog] = useState(false);
  const [handoffTo, setHandoffTo] = useState<string>("");
  const [handoffNotes, setHandoffNotes] = useState("");
  const [handingOff, setHandingOff] = useState(false);
  const [handoffHistory, setHandoffHistory] = useState<HandoffHistory[]>([]);
  const [loadingHandoffHistory, setLoadingHandoffHistory] = useState(false);
  const [handoffUserSearch, setHandoffUserSearch] = useState("");
  const [handoffPopoverOpen, setHandoffPopoverOpen] = useState(false);

  // AI Feedback state
  const [aiFeedbackText, setAiFeedbackText] = useState("");
  const [aiCorrectedType, setAiCorrectedType] = useState<string>("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const loadNotesAndActivity = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const [notesRes, activityRes] = await Promise.all([
        fetch(`/api/taskpool/tasks/${task.id}/notes`),
        fetch(`/api/taskpool/tasks/${task.id}/activity`),
      ]);

      if (notesRes.ok) {
        const data = await notesRes.json();
        setNotes(data.notes || []);
      }
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivity(data.activity || []);
      }
    } catch (error) {
      console.error("Error loading task details:", error);
    } finally {
      setLoadingNotes(false);
    }
  }, [task.id]);

  const loadSteps = useCallback(async () => {
    setLoadingSteps(true);
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/steps`);
      if (response.ok) {
        const data = await response.json();
        setSteps(data.steps || []);
      }
    } catch (error) {
      console.error("Error loading steps:", error);
    } finally {
      setLoadingSteps(false);
    }
  }, [task.id]);

  useEffect(() => {
    if (open) {
      loadNotesAndActivity();
      loadSteps();
      setEditForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        due_date: task.due_date || "",
        alert_threshold_hours: task.alert_threshold_hours || 24,
        action_type_id: task.action_type_id,
      });
    }
  }, [open, task, loadNotesAndActivity, loadSteps]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setSubmittingNote(true);
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });

      if (response.ok) {
        setNewNote("");
        loadNotesAndActivity();
        toast.success("Note added");
      } else {
        toast.error("Failed to add note");
      }
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const body: Record<string, any> = {};
      if (routeToActionType && routeToActionType !== "none") {
        body.route_to_action_type_id = routeToActionType;
        body.route_title = routeTitle || undefined;
      }

      const response = await fetch(`/api/taskpool/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(
          routeToActionType && routeToActionType !== "none"
            ? "Task completed and routed to next action"
            : "Task completed"
        );
        setShowCompleteDialog(false);
        onUpdate();
      } else {
        toast.error("Failed to complete task");
      }
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Failed to complete task");
    } finally {
      setCompleting(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        toast.success("Task updated");
        setEditing(false);
        onUpdate();
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Task deleted");
        onUpdate();
      } else {
        toast.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  // Step handlers
  const handleAddStep = async () => {
    if (!newStepDescription.trim()) return;
    setAddingStep(true);
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newStepDescription.trim() }),
      });
      if (response.ok) {
        setNewStepDescription("");
        loadSteps();
        loadNotesAndActivity(); // Refresh activity log
        toast.success("Step added");
      } else {
        toast.error("Failed to add step");
      }
    } catch (error) {
      console.error("Error adding step:", error);
      toast.error("Failed to add step");
    } finally {
      setAddingStep(false);
    }
  };

  const handleToggleStepComplete = async (step: TaskStep) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/steps/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: !step.is_completed }),
      });
      if (response.ok) {
        const data = await response.json();
        loadSteps();
        loadNotesAndActivity();
        if (data.all_steps_completed) {
          toast.success("All steps completed! Consider completing the task.");
        }
      } else {
        toast.error("Failed to update step");
      }
    } catch (error) {
      console.error("Error updating step:", error);
      toast.error("Failed to update step");
    }
  };

  const handleAssignStep = async (stepId: string, userId: string | null) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: userId }),
      });
      if (response.ok) {
        loadSteps();
        setStepAssignPopover(null);
        toast.success(userId ? "Step assigned" : "Step unassigned");
      } else {
        toast.error("Failed to assign step");
      }
    } catch (error) {
      console.error("Error assigning step:", error);
      toast.error("Failed to assign step");
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/steps/${stepId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        loadSteps();
        loadNotesAndActivity();
        toast.success("Step deleted");
      } else {
        toast.error("Failed to delete step");
      }
    } catch (error) {
      console.error("Error deleting step:", error);
      toast.error("Failed to delete step");
    }
  };

  // Handoff handlers
  const loadHandoffHistory = useCallback(async () => {
    setLoadingHandoffHistory(true);
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/handoff`);
      if (response.ok) {
        const data = await response.json();
        setHandoffHistory(data.history || []);
      }
    } catch (error) {
      console.error("Error loading handoff history:", error);
    } finally {
      setLoadingHandoffHistory(false);
    }
  }, [task.id]);

  const handleHandoff = async () => {
    if (!handoffTo) {
      toast.error("Please select a user to hand off to");
      return;
    }
    setHandingOff(true);
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handoff_to: handoffTo,
          handoff_notes: handoffNotes || undefined,
        }),
      });
      if (response.ok) {
        const selectedUser = users.find(u => u.id === handoffTo);
        toast.success(`Task handed off to ${selectedUser?.full_name || selectedUser?.email || "user"}`);
        setShowHandoffDialog(false);
        setHandoffTo("");
        setHandoffNotes("");
        onUpdate();
      } else {
        toast.error("Failed to hand off task");
      }
    } catch (error) {
      console.error("Error handing off task:", error);
      toast.error("Failed to hand off task");
    } finally {
      setHandingOff(false);
    }
  };

  const handleAcceptHandoff = async () => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/handoff`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Handoff accepted! You now own this task.");
        onUpdate();
      } else {
        toast.error("Failed to accept handoff");
      }
    } catch (error) {
      console.error("Error accepting handoff:", error);
      toast.error("Failed to accept handoff");
    }
  };

  // AI Feedback handlers
  const handleSubmitAiFeedback = async (wasCorrect: boolean) => {
    setSubmittingFeedback(true);
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/ai-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          was_correct: wasCorrect,
          corrected_action_type_id: wasCorrect ? undefined : aiCorrectedType || undefined,
          feedback_text: aiFeedbackText || undefined,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setFeedbackSubmitted(true);
        if (wasCorrect) {
          toast.success("Thanks! AI classification confirmed as correct.");
        } else if (data.updated) {
          toast.success("Feedback submitted and task category updated.");
          onUpdate();
        } else {
          toast.success("Feedback submitted for AI training.");
        }
        setAiFeedbackText("");
        setAiCorrectedType("");
      } else {
        toast.error("Failed to submit feedback");
      }
    } catch (error) {
      console.error("Error submitting AI feedback:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Load users for assignment dropdown
  const loadUsers = useCallback(async (search: string = "") => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      const response = await fetch(`/api/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Load AI suggested assignee based on task source type
  const loadSuggestedAssignee = useCallback(async () => {
    if (!task.source_type || task.assigned_to) return; // Only suggest for unassigned tasks

    setLoadingSuggestion(true);
    try {
      const params = new URLSearchParams({
        suggest_assignee: "true",
        source_type: task.source_type,
      });
      // Add category if available from AI extracted data
      const category = task.ai_extracted_data?.category;
      if (category) params.append("category", category);

      const response = await fetch(`/api/ai-learning?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.hasSuggestion && data.suggestion) {
          setSuggestedAssignee(data.suggestion);
        }
      }
    } catch (error) {
      console.error("Error loading suggested assignee:", error);
    } finally {
      setLoadingSuggestion(false);
    }
  }, [task.source_type, task.ai_extracted_data, task.assigned_to]);

  // Load users and suggestion when popover opens
  useEffect(() => {
    if (assignPopoverOpen) {
      loadUsers(userSearch);
      loadSuggestedAssignee();
    }
  }, [assignPopoverOpen, userSearch, loadUsers, loadSuggestedAssignee]);

  // Load users when step assign popover opens
  useEffect(() => {
    if (stepAssignPopover) {
      loadUsers(stepUserSearch);
    }
  }, [stepAssignPopover, stepUserSearch, loadUsers]);

  // Load users when handoff dialog opens
  useEffect(() => {
    if (showHandoffDialog) {
      loadUsers(handoffUserSearch);
      loadHandoffHistory();
    }
  }, [showHandoffDialog, handoffUserSearch, loadUsers, loadHandoffHistory]);

  const handleAssignTask = async (userId: string) => {
    setAssigning(true);
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: userId }),
      });

      if (response.ok) {
        const selectedUser = users.find(u => u.id === userId);
        toast.success(`Task assigned to ${selectedUser?.full_name || selectedUser?.email || "user"}`);
        setAssignPopoverOpen(false);
        onUpdate();
      } else {
        toast.error("Failed to assign task");
      }
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignTask = async () => {
    setAssigning(true);
    try {
      const response = await fetch(`/api/taskpool/tasks/${task.id}/assign`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Task unassigned");
        onUpdate();
      } else {
        toast.error("Failed to unassign task");
      }
    } catch (error) {
      console.error("Error unassigning task:", error);
      toast.error("Failed to unassign task");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        {/* Compact Header */}
        <div className="sticky top-0 bg-background z-10 border-b">
          <div className="p-4 pr-10">
            {/* Title Row */}
            <div className="flex items-center gap-2 mb-2">
              {task.action_type && (
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: task.action_type.color }}
                />
              )}
              <DialogTitle className="text-lg font-semibold leading-tight line-clamp-1">
                {task.title}
              </DialogTitle>
            </div>

            {/* Badges Row - Compact */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{ borderColor: task.action_type?.color, color: task.action_type?.color }}
              >
                {task.action_type?.label}
              </Badge>
              <Badge className={cn("text-[10px] px-1.5 py-0", priorityColors[task.priority])}>
                {task.priority}
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                {task.status.replace('_', ' ')}
              </Badge>
              {task.ai_confidence && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5" />
                  {Math.round(task.ai_confidence * 100)}%
                </Badge>
              )}
            </div>
          </div>

          {/* Action Bar - Clean horizontal layout */}
          {task.status !== "completed" && (
            <div className="flex items-center gap-1 px-4 pb-3">
              {/* Assign/Reassign dropdown */}
              <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={assigning}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    {task.assigned_to ? "Reassign" : "Assign"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search users..."
                      value={userSearch}
                      onValueChange={setUserSearch}
                      className="h-8 text-sm"
                    />
                    <CommandList className="max-h-56">
                      <CommandEmpty className="py-2 text-xs text-center">
                        {loadingUsers ? "Loading..." : "No users found"}
                      </CommandEmpty>
                      {/* AI Suggested Assignee */}
                      {suggestedAssignee && suggestedAssignee.user && !task.assigned_to && (
                        <CommandGroup heading="AI Suggested">
                          <CommandItem
                            value={`suggested-${suggestedAssignee.userId}`}
                            onSelect={() => handleAssignTask(suggestedAssignee.userId)}
                            className="cursor-pointer py-2 bg-purple-50 hover:bg-purple-100 border-l-2 border-purple-500"
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-2 text-purple-600" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate block">
                                {suggestedAssignee.user.full_name || suggestedAssignee.user.email}
                              </span>
                              <span className="text-[10px] text-purple-600">
                                {Math.round(suggestedAssignee.confidence * 100)}% confidence
                              </span>
                            </div>
                          </CommandItem>
                        </CommandGroup>
                      )}
                      {loadingSuggestion && !suggestedAssignee && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Finding best assignee...
                        </div>
                      )}
                      <CommandGroup heading="All Users">
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={() => handleAssignTask(user.id)}
                            className="cursor-pointer py-1.5"
                          >
                            <User className="h-3.5 w-3.5 mr-2" />
                            <span className="text-sm truncate">{user.full_name || user.email}</span>
                            {suggestedAssignee?.userId === user.id && (
                              <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 text-purple-600 border-purple-300">
                                AI Pick
                              </Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {task.assigned_to && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnassignTask}
                  disabled={assigning}
                  className="h-8 px-2 text-xs text-muted-foreground"
                >
                  <X className="h-3 w-3 mr-1" />
                  Unassign
                </Button>
              )}

              <div className="h-4 w-px bg-border mx-1" />

              {!task.claimed_by ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onClaim(task.id)}
                  className="h-8 px-2 text-xs"
                >
                  <Hand className="h-3.5 w-3.5 mr-1" />
                  Claim
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRelease(task.id)}
                  className="h-8 px-2 text-xs text-muted-foreground"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  Release
                </Button>
              )}

              {/* Handoff button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowHandoffDialog(true);
                  loadUsers("");
                }}
                className="h-8 px-2 text-xs"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                Handoff
              </Button>

              <div className="flex-1" />

              {/* Primary action - Complete */}
              <Button
                size="sm"
                onClick={() => setShowCompleteDialog(true)}
                className="h-8 px-3 text-xs"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Complete
              </Button>
            </div>
          )}
        </div>

        <DialogHeader className="sr-only">
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="px-4 pb-4">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="steps">
              Steps {steps.length > 0 && `(${steps.filter(s => s.is_completed).length}/${steps.length})`}
            </TabsTrigger>
            <TabsTrigger value="notes">
              Notes {notes.length > 0 && `(${notes.length})`}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
          </TabsList>

          <div>
            <TabsContent value="details" className="mt-0 space-y-4">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm({ ...editForm, title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({ ...editForm, description: e.target.value })
                      }
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Action Type</Label>
                      <Select
                        value={editForm.action_type_id}
                        onValueChange={(value) =>
                          setEditForm({ ...editForm, action_type_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {actionTypes.map((at) => (
                            <SelectItem key={at.id} value={at.id}>
                              {at.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select
                        value={editForm.priority}
                        onValueChange={(value) =>
                          setEditForm({ ...editForm, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) =>
                          setEditForm({ ...editForm, due_date: e.target.value })
                        }
                      />
                    </div>
                    {editForm.due_date && (
                      <div>
                        <Label>Alert Reminder</Label>
                        <Select
                          value={String(editForm.alert_threshold_hours)}
                          onValueChange={(value) =>
                            setEditForm({ ...editForm, alert_threshold_hours: parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 hour before</SelectItem>
                            <SelectItem value="2">2 hours before</SelectItem>
                            <SelectItem value="4">4 hours before</SelectItem>
                            <SelectItem value="8">8 hours before</SelectItem>
                            <SelectItem value="24">1 day before</SelectItem>
                            <SelectItem value="48">2 days before</SelectItem>
                            <SelectItem value="72">3 days before</SelectItem>
                            <SelectItem value="168">1 week before</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEdit}>Save Changes</Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-medium mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {task.description || "No description"}
                    </p>
                  </div>

                  <Separator />

                  {/* Client Info */}
                  {task.client && (
                    <>
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Client
                        </h4>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                          <p className="font-medium">
                            {task.client.first_name} {task.client.last_name}
                          </p>
                          {task.client.company && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {task.client.company}
                            </p>
                          )}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Due Date</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {task.due_date
                          ? format(new Date(task.due_date), "PPP")
                          : "No due date"}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Created</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(task.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Source</h4>
                      <p className="text-sm text-muted-foreground capitalize">
                        {task.source_type}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Assigned</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <UserPlus className="h-3 w-3" />
                        {task.assigned_at
                          ? formatDistanceToNow(new Date(task.assigned_at), {
                              addSuffix: true,
                            })
                          : "Not assigned"}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Claimed</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Hand className="h-3 w-3" />
                        {task.claimed_at
                          ? formatDistanceToNow(new Date(task.claimed_at), {
                              addSuffix: true,
                            })
                          : "Not claimed"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="steps" className="mt-0 space-y-4">
              {/* Progress indicator */}
              {steps.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {steps.filter(s => s.is_completed).length} of {steps.length} completed
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(steps.filter(s => s.is_completed).length / steps.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Add Step Form */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a new step..."
                  value={newStepDescription}
                  onChange={(e) => setNewStepDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddStep();
                    }
                  }}
                  disabled={addingStep}
                />
                <Button
                  size="sm"
                  onClick={handleAddStep}
                  disabled={!newStepDescription.trim() || addingStep}
                >
                  {addingStep ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Steps List */}
              {loadingSteps ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : steps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No steps yet</p>
                  <p className="text-xs">Break this task into smaller steps</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        step.is_completed
                          ? "bg-muted/30 border-muted"
                          : "bg-background hover:bg-muted/20"
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleStepComplete(step)}
                        className={cn(
                          "mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          step.is_completed
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30 hover:border-primary"
                        )}
                      >
                        {step.is_completed && <Check className="h-3 w-3" />}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm",
                            step.is_completed && "line-through text-muted-foreground"
                          )}
                        >
                          {step.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {step.assigned_user && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {step.assigned_user.full_name || step.assigned_user.email}
                            </span>
                          )}
                          {step.completed_at && (
                            <span>
                              Completed {formatDistanceToNow(new Date(step.completed_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {/* Assign dropdown */}
                        <Popover
                          open={stepAssignPopover === step.id}
                          onOpenChange={(open) => {
                            setStepAssignPopover(open ? step.id : null);
                            if (!open) setStepUserSearch("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-0" align="end">
                            <Command>
                              <CommandInput
                                placeholder="Search users..."
                                value={stepUserSearch}
                                onValueChange={setStepUserSearch}
                                className="h-8 text-sm"
                              />
                              <CommandList className="max-h-48">
                                <CommandEmpty className="py-2 text-xs text-center">
                                  {loadingUsers ? "Loading..." : "No users found"}
                                </CommandEmpty>
                                <CommandGroup>
                                  {step.assigned_to && (
                                    <CommandItem
                                      onSelect={() => handleAssignStep(step.id, null)}
                                      className="cursor-pointer py-1.5 text-muted-foreground"
                                    >
                                      <X className="h-3.5 w-3.5 mr-2" />
                                      <span className="text-sm">Unassign</span>
                                    </CommandItem>
                                  )}
                                  {users.map((user) => (
                                    <CommandItem
                                      key={user.id}
                                      value={user.id}
                                      onSelect={() => handleAssignStep(step.id, user.id)}
                                      className="cursor-pointer py-1.5"
                                    >
                                      <User className="h-3.5 w-3.5 mr-2" />
                                      <span className="text-sm truncate">
                                        {user.full_name || user.email}
                                      </span>
                                      {step.assigned_to === user.id && (
                                        <Check className="h-3.5 w-3.5 ml-auto" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteStep(step.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-4">
              {/* Add Note */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || submittingNote}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Add Note
                </Button>
              </div>

              <Separator />

              {/* Notes List */}
              {loadingNotes ? (
                <p className="text-sm text-muted-foreground">Loading notes...</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-muted/50 rounded-lg p-3 space-y-1"
                    >
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              {loadingNotes ? (
                <p className="text-sm text-muted-foreground">Loading activity...</p>
              ) : activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-2">
                  {activity.map((log) => {
                    const Icon = activityIcons[log.action] || Activity;
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 py-2 border-b last:border-0"
                      >
                        <div className="p-1.5 bg-muted rounded">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm capitalize">
                            {log.action.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai" className="mt-0 space-y-4">
              {/* AI Classification Info */}
              {task.ai_confidence && (
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Classification
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(task.ai_confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Classified as:</span>
                    <Badge
                      variant="outline"
                      style={{ borderColor: task.action_type?.color, color: task.action_type?.color }}
                    >
                      {task.action_type?.label}
                    </Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${task.ai_confidence * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* AI Feedback Section */}
              {task.ai_confidence && !feedbackSubmitted ? (
                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Train the AI
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Was the AI classification correct? Your feedback helps improve accuracy.
                  </p>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleSubmitAiFeedback(true)}
                      disabled={submittingFeedback}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Correct
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                      onClick={() => setAiCorrectedType("show")}
                      disabled={submittingFeedback}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Needs Correction
                    </Button>
                  </div>

                  {/* Correction Form */}
                  {aiCorrectedType === "show" && (
                    <div className="space-y-3 pt-2 border-t">
                      <div>
                        <Label className="text-xs">Correct Category</Label>
                        <Select
                          value={aiCorrectedType !== "show" ? aiCorrectedType : ""}
                          onValueChange={setAiCorrectedType}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select correct category..." />
                          </SelectTrigger>
                          <SelectContent>
                            {actionTypes
                              .filter((at) => at.id !== task.action_type_id)
                              .map((at) => (
                                <SelectItem key={at.id} value={at.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: at.color }}
                                    />
                                    {at.label}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Additional Feedback (optional)</Label>
                        <Textarea
                          value={aiFeedbackText}
                          onChange={(e) => setAiFeedbackText(e.target.value)}
                          placeholder="Why was this misclassified? What should the AI look for?"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiCorrectedType("");
                            setAiFeedbackText("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSubmitAiFeedback(false)}
                          disabled={submittingFeedback || !aiCorrectedType || aiCorrectedType === "show"}
                        >
                          {submittingFeedback ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            "Submit Correction"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : feedbackSubmitted ? (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-center">
                  <Check className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-sm font-medium text-green-800">Thanks for your feedback!</p>
                  <p className="text-xs text-green-600">This helps improve AI accuracy.</p>
                </div>
              ) : null}

              {/* AI Extracted Data */}
              {task.ai_extracted_data &&
              Object.keys(task.ai_extracted_data).length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Extracted Data
                  </h4>
                  <pre className="text-xs overflow-auto max-h-48 bg-background rounded p-2">
                    {JSON.stringify(task.ai_extracted_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* No AI Data */}
              {!task.ai_confidence && (!task.ai_extracted_data || Object.keys(task.ai_extracted_data).length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No AI data available</p>
                  <p className="text-xs">This task was created manually</p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Complete Dialog */}
        {showCompleteDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
              <h3 className="text-lg font-semibold">Complete Task</h3>
              <p className="text-sm text-muted-foreground">
                Optionally route this task to another action type for follow-up.
              </p>

              <div className="space-y-3">
                <div>
                  <Label>Route to Action Type (Optional)</Label>
                  <Select
                    value={routeToActionType}
                    onValueChange={setRouteToActionType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {actionTypes
                        .filter((at) => at.id !== task.action_type_id)
                        .map((at) => (
                          <SelectItem key={at.id} value={at.id}>
                            {at.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {routeToActionType && routeToActionType !== "none" && (
                  <div>
                    <Label>New Task Title (Optional)</Label>
                    <Input
                      value={routeTitle}
                      onChange={(e) => setRouteTitle(e.target.value)}
                      placeholder={`Follow-up: ${task.title}`}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCompleteDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleComplete} disabled={completing}>
                  {completing ? "Completing..." : "Complete Task"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Handoff Dialog */}
        {showHandoffDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Hand Off Task</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Transfer this task to another team member. They will be notified and can continue where you left off.
              </p>

              <div className="space-y-4">
                {/* User selector */}
                <div>
                  <Label>Hand off to</Label>
                  <Popover open={handoffPopoverOpen} onOpenChange={setHandoffPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {handoffTo
                          ? users.find((u) => u.id === handoffTo)?.full_name ||
                            users.find((u) => u.id === handoffTo)?.email ||
                            "Select user..."
                          : "Select user..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search users..."
                          value={handoffUserSearch}
                          onValueChange={setHandoffUserSearch}
                        />
                        <CommandList className="max-h-48">
                          <CommandEmpty>
                            {loadingUsers ? "Loading..." : "No users found"}
                          </CommandEmpty>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.id}
                                onSelect={() => {
                                  setHandoffTo(user.id);
                                  setHandoffPopoverOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <User className="h-4 w-4 mr-2" />
                                <span>{user.full_name || user.email}</span>
                                {handoffTo === user.id && (
                                  <Check className="h-4 w-4 ml-auto" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Handoff notes */}
                <div>
                  <Label>Notes for recipient (optional)</Label>
                  <Textarea
                    value={handoffNotes}
                    onChange={(e) => setHandoffNotes(e.target.value)}
                    placeholder="Add context or instructions for the next person..."
                    rows={3}
                  />
                </div>

                {/* Handoff History */}
                {handoffHistory.length > 0 && (
                  <div>
                    <Label className="flex items-center gap-1 mb-2">
                      <History className="h-3.5 w-3.5" />
                      Previous Handoffs
                    </Label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {handoffHistory.map((h) => (
                        <div
                          key={h.id}
                          className="text-xs bg-muted/50 rounded p-2"
                        >
                          <div className="flex items-center gap-1">
                            <span className="font-medium">
                              {h.from_user.full_name || h.from_user.email}
                            </span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-medium">
                              {h.to_user.full_name || h.to_user.email}
                            </span>
                          </div>
                          {h.notes && (
                            <p className="text-muted-foreground mt-1">{h.notes}</p>
                          )}
                          <p className="text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowHandoffDialog(false);
                    setHandoffTo("");
                    setHandoffNotes("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleHandoff}
                  disabled={!handoffTo || handingOff}
                >
                  {handingOff ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Handing off...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                      Hand Off
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
