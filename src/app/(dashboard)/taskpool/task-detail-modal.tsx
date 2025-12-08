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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  ai_confidence: number | null;
  ai_extracted_data: Record<string, any>;
  source_type: string;
  action_type: ActionType | null;
  client: Client | null;
}

interface Note {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  details: Record<string, any>;
  performed_by: string;
  created_at: string;
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
    action_type_id: task.action_type_id,
  });

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

  useEffect(() => {
    if (open) {
      loadNotesAndActivity();
      setEditForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        due_date: task.due_date || "",
        action_type_id: task.action_type_id,
      });
    }
  }, [open, task, loadNotesAndActivity]);

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
      if (routeToActionType) {
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
          routeToActionType
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {task.action_type && (
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: task.action_type.color }}
                >
                  <FileText className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <DialogTitle className="text-xl">{task.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{task.action_type?.label}</Badge>
                  <Badge className={cn(priorityColors[task.priority], "text-white")}>
                    {task.priority}
                  </Badge>
                  <Badge variant="secondary">{task.status}</Badge>
                  {task.ai_confidence && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI {Math.round(task.ai_confidence * 100)}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.status !== "completed" && (
                <>
                  {!task.claimed_by ? (
                    <Button
                      size="sm"
                      onClick={() => onClaim(task.id)}
                      className="flex items-center gap-1"
                    >
                      <Hand className="h-4 w-4" />
                      Claim
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRelease(task.id)}
                      className="flex items-center gap-1"
                    >
                      <Undo2 className="h-4 w-4" />
                      Release
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setShowCompleteDialog(true)}
                    className="flex items-center gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Complete
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="notes">
              Notes {notes.length > 0 && `(${notes.length})`}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="ai">AI Data</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
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
                      <h4 className="text-sm font-medium mb-1">Claimed</h4>
                      <p className="text-sm text-muted-foreground">
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

            <TabsContent value="ai" className="mt-0">
              {task.ai_extracted_data &&
              Object.keys(task.ai_extracted_data).length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Extracted Data
                    </h4>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(task.ai_extracted_data, null, 2)}
                    </pre>
                  </div>
                  {task.ai_confidence && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Confidence Score</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${task.ai_confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {Math.round(task.ai_confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No AI data available</p>
                  <p className="text-xs">This task was created manually</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
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
                      <SelectItem value="">None</SelectItem>
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

                {routeToActionType && (
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
      </DialogContent>
    </Dialog>
  );
}
