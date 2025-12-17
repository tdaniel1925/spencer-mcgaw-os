"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Check,
  X,
  User,
  Clock,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  Phone,
  Mail,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  source_type: string;
  source_id: string;
  source_metadata: Record<string, unknown>;
  suggested_title: string;
  suggested_description: string;
  suggested_priority: string;
  suggested_due_date: string | null;
  suggested_assigned_to: string | null;
  suggested_client_id: string | null;
  ai_reasoning: string;
  ai_confidence: number;
  ai_category: string;
  ai_keywords: string[];
  status: string;
  created_at: string;
  expires_at: string;
  client?: {
    id: string;
    first_name: string;
    last_name: string;
    company_name: string | null;
  } | null;
  assigned_user?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface SuggestionCounts {
  pending: number;
  approved: number;
  declined: number;
  expired: number;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

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

const sourceTypeIcons: Record<string, React.ElementType> = {
  phone_call: Phone,
  email: Mail,
  form: AlertCircle,
};

const declineCategories = [
  { value: "not_needed", label: "Not needed - no action required" },
  { value: "duplicate", label: "Duplicate - already have a similar task" },
  { value: "wrong_type", label: "Wrong type - doesn't fit this category" },
  { value: "wrong_assignee", label: "Wrong assignee - should go to someone else" },
  { value: "wrong_client", label: "Wrong client - misidentified the client" },
  { value: "other", label: "Other reason" },
];

interface SuggestedTasksProps {
  onSuggestionCount?: (count: number) => void;
}

export function SuggestedTasks({ onSuggestionCount }: SuggestedTasksProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [counts, setCounts] = useState<SuggestionCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Decline dialog state
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [decliningSuggestion, setDecliningSuggestion] = useState<Suggestion | null>(null);
  const [declineCategory, setDeclineCategory] = useState<string>("");
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  // Approve state
  const [approving, setApproving] = useState<string | null>(null);

  const loadSuggestions = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await fetch("/api/tasks/suggestions?status=pending");
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setCounts(data.counts || null);
        onSuggestionCount?.(data.counts?.pending || 0);
      }
    } catch (error) {
      console.error("Error loading suggestions:", error);
      toast.error("Failed to load suggestions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onSuggestionCount]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
    loadUsers();
  }, [loadSuggestions, loadUsers]);

  const handleApprove = async (suggestion: Suggestion, modifications?: Record<string, unknown>) => {
    setApproving(suggestion.id);

    try {
      const response = await fetch(`/api/tasks/suggestions/${suggestion.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modifications || {}),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          data.wasModified
            ? "Task created with your modifications"
            : "Task created successfully"
        );
        loadSuggestions(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to approve suggestion");
      }
    } catch (error) {
      console.error("Error approving suggestion:", error);
      toast.error("Failed to approve suggestion");
    } finally {
      setApproving(null);
    }
  };

  const handleDeclineClick = (suggestion: Suggestion) => {
    setDecliningSuggestion(suggestion);
    setDeclineCategory("");
    setDeclineReason("");
    setDeclineDialogOpen(true);
  };

  const handleDeclineSubmit = async () => {
    if (!decliningSuggestion || !declineCategory) return;

    setDeclining(true);

    try {
      const response = await fetch(`/api/tasks/suggestions/${decliningSuggestion.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: declineCategory,
          reason: declineReason || declineCategories.find(c => c.value === declineCategory)?.label || "No reason provided",
        }),
      });

      if (response.ok) {
        toast.success("Feedback recorded. This helps improve future suggestions!");
        setDeclineDialogOpen(false);
        loadSuggestions(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to decline suggestion");
      }
    } catch (error) {
      console.error("Error declining suggestion:", error);
      toast.error("Failed to decline suggestion");
    } finally {
      setDeclining(false);
    }
  };

  const renderSuggestionCard = (suggestion: Suggestion) => {
    const SourceIcon = sourceTypeIcons[suggestion.source_type] || AlertCircle;
    const isExpiringSoon = suggestion.expires_at &&
      new Date(suggestion.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000;

    return (
      <div
        key={suggestion.id}
        className={cn(
          "bg-background rounded-lg border shadow-sm overflow-hidden",
          "hover:shadow-md transition-shadow duration-200"
        )}
      >
        {/* Priority indicator strip */}
        <div
          className={cn(
            "h-1 w-full",
            priorityDotColors[suggestion.suggested_priority] || "bg-gray-300"
          )}
        />

        <div className="p-4">
          {/* Header with badges */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 border-purple-200"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                AI Suggested
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs px-2 py-0.5 capitalize",
                  priorityColors[suggestion.suggested_priority]
                )}
              >
                {suggestion.suggested_priority}
              </Badge>
              {isExpiringSoon && (
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-200"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Expires soon
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <SourceIcon className="h-3.5 w-3.5" />
              <span className="capitalize">{suggestion.source_type.replace("_", " ")}</span>
            </div>
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold text-foreground mb-2">
            {suggestion.suggested_title}
          </h4>

          {/* Description */}
          {suggestion.suggested_description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {suggestion.suggested_description}
            </p>
          )}

          {/* AI Reasoning */}
          <div className="bg-muted/50 rounded-md p-2.5 mb-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">AI reasoning:</span>{" "}
              {suggestion.ai_reasoning}
            </p>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
            {suggestion.client && (
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span>
                  {suggestion.client.first_name} {suggestion.client.last_name}
                </span>
              </div>
            )}
            {suggestion.suggested_due_date && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Due {new Date(suggestion.suggested_due_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <span className="font-medium">Confidence:</span>
              <span className={cn(
                suggestion.ai_confidence >= 0.8 ? "text-green-600" :
                suggestion.ai_confidence >= 0.6 ? "text-yellow-600" : "text-orange-600"
              )}>
                {Math.round(suggestion.ai_confidence * 100)}%
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-3 border-t">
            <Button
              variant="default"
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleApprove(suggestion)}
              disabled={approving === suggestion.id}
            >
              {approving === suggestion.id ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => handleDeclineClick(suggestion)}
              disabled={approving === suggestion.id}
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              Decline
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Suggestions</h2>
            <p className="text-sm text-muted-foreground">
              Review and approve AI-suggested tasks from calls and emails
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadSuggestions(false)}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {counts && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-700">{counts.pending}</div>
            <div className="text-xs text-yellow-600">Pending</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{counts.approved}</div>
            <div className="text-xs text-green-600">Approved</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{counts.declined}</div>
            <div className="text-xs text-red-600">Declined</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{counts.expired}</div>
            <div className="text-xs text-gray-600">Expired</div>
          </div>
        </div>
      )}

      {/* Suggestions grid */}
      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-muted rounded-full mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No pending suggestions</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            When calls come in, AI will analyze them and suggest tasks here for your review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestions.map(renderSuggestionCard)}
        </div>
      )}

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Suggestion</DialogTitle>
            <DialogDescription>
              Help improve future suggestions by telling us why this one wasn&apos;t right.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Why are you declining this suggestion?</Label>
              <Select value={declineCategory} onValueChange={setDeclineCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {declineCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional details (optional)</Label>
              <Textarea
                placeholder="Any additional context that would help improve suggestions..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineDialogOpen(false)}
              disabled={declining}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclineSubmit}
              disabled={!declineCategory || declining}
            >
              {declining ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ThumbsDown className="h-4 w-4 mr-2" />
              )}
              Decline & Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
