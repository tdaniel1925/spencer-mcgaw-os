"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mail, Phone, Check, X, Loader2, ChevronRight, UserPlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/lib/supabase/auth-context";

interface PotentialTask {
  id: string;
  source_email_from: string | null;
  source_email_subject: string | null;
  source_email_received_at: string | null;
  suggested_title: string;
  suggested_description: string | null;
  suggested_priority: "urgent" | "high" | "medium" | "low";
  suggested_due_date: string | null;
  ai_confidence: number;
  ai_reasoning: string | null;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
}

interface AITaskSuggestionsProps {
  onTaskApproved?: () => void;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
}

export function AITaskSuggestions({ onTaskApproved }: AITaskSuggestionsProps) {
  const { user: currentUser } = useAuth();
  const [suggestions, setSuggestions] = useState<PotentialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PotentialTask | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("me");

  const fetchSuggestions = async () => {
    try {
      const res = await fetch("/api/potential-tasks?status=pending&limit=10");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSuggestions(data.potentialTasks || []);
    } catch (error) {
      console.error("Failed to fetch AI suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    fetchUsers();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSuggestions, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = (suggestion: PotentialTask) => {
    setSelectedSuggestion(suggestion);
    setSelectedAssignee("me");
    setAssignDialogOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedSuggestion) return;

    setProcessingId(selectedSuggestion.id);
    setAssignDialogOpen(false);

    try {
      // Determine assignee ID
      const assigneeId = selectedAssignee === "me" ? currentUser?.id : selectedAssignee;

      const res = await fetch("/api/potential-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          potentialTaskId: selectedSuggestion.id,
          action: "approve",
          assignedTo: assigneeId,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve");
      }

      const assigneeName = selectedAssignee === "me"
        ? "yourself"
        : users.find(u => u.id === selectedAssignee)?.full_name || "user";

      toast.success("Task created!", {
        description: `Assigned to ${assigneeName}`,
        duration: 4000,
      });

      // Remove from list
      setSuggestions((prev) => prev.filter((s) => s.id !== selectedSuggestion.id));

      // Notify parent to refresh tasks
      onTaskApproved?.();
    } catch (error) {
      toast.error("Failed to create task", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setProcessingId(null);
      setSelectedSuggestion(null);
    }
  };

  const handleDismiss = async (suggestion: PotentialTask) => {
    setProcessingId(suggestion.id);
    try {
      const res = await fetch("/api/potential-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          potentialTaskId: suggestion.id,
          action: "dismiss",
          dismissalReason: "User dismissed from dashboard",
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to dismiss");
      }

      toast.success("Suggestion dismissed");

      // Remove from list
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (error) {
      toast.error("Failed to dismiss", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "low":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600";
    if (confidence >= 60) return "text-blue-600";
    return "text-amber-600";
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading AI suggestions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null; // Hide if no suggestions
  }

  const displaySuggestions = showAll ? suggestions : suggestions.slice(0, 3);

  return (
    <Card className="border-border/50 bg-gradient-to-br from-violet-50/30 to-fuchsia-50/30 dark:from-violet-950/10 dark:to-fuchsia-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle className="text-base font-semibold">
              AI Task Suggestions
            </CardTitle>
            <Badge variant="secondary" className="ml-1">
              {suggestions.length}
            </Badge>
          </div>
          {suggestions.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs"
            >
              {showAll ? "Show Less" : `Show All (${suggestions.length})`}
              <ChevronRight className={cn("h-3 w-3 ml-1 transition-transform", showAll && "rotate-90")} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {displaySuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="group relative bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {suggestion.source_email_from ? (
                  <Mail className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Phone className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm text-foreground line-clamp-1">
                    {suggestion.suggested_title}
                  </h4>
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-medium capitalize flex-shrink-0", getPriorityColor(suggestion.suggested_priority))}
                  >
                    {suggestion.suggested_priority}
                  </Badge>
                </div>

                {suggestion.suggested_description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {suggestion.suggested_description}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs">
                  {suggestion.source_email_from && (
                    <span className="text-muted-foreground">
                      From: <span className="font-medium">{suggestion.source_email_from}</span>
                    </span>
                  )}
                  {suggestion.source_email_received_at && (
                    <span className="text-muted-foreground">
                      {format(new Date(suggestion.source_email_received_at), "MMM d, h:mm a")}
                    </span>
                  )}
                  <span className={cn("font-medium", getConfidenceColor(suggestion.ai_confidence))}>
                    {suggestion.ai_confidence}% confident
                  </span>
                </div>

                {suggestion.ai_reasoning && (
                  <p className="text-xs text-muted-foreground/80 mt-2 italic line-clamp-1">
                    "{suggestion.ai_reasoning}"
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleApprove(suggestion)}
                  disabled={processingId === suggestion.id}
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                  title="Approve and create task"
                >
                  {processingId === suggestion.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(suggestion)}
                  disabled={processingId === suggestion.id}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  title="Dismiss suggestion"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {/* Assignment Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Assign Task
              </DialogTitle>
              <DialogDescription>
                Who should this task be assigned to?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedSuggestion && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="font-medium text-sm">{selectedSuggestion.suggested_title}</p>
                  {selectedSuggestion.suggested_description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedSuggestion.suggested_description}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to:</label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="me">Myself</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmApprove}>
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
