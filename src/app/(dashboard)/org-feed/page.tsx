"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Phone,
  Mail,
  Clock,
  User,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ListTodo,
  CheckCircle,
  Building2,
  ArrowRight,
  Sparkles,
  Play,
  Pause,
  Volume2,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// Types matching the API
interface OrgFeedItem {
  id: string;
  type: "call" | "email";
  timestamp: string;
  summary: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  from: {
    name: string | null;
    identifier: string;
  };
  hasTask: boolean;
  callData?: {
    duration: number | null;
    status: string;
    direction: string;
    recordingUrl: string | null;
    category: string | null;
    sentiment: string | null;
    actionItems: string[];
  };
  emailData?: {
    subject: string;
    accountEmail: string;
    category: string;
    requiresResponse: boolean;
    actionItems: Array<{
      id: string;
      title: string;
      type: string;
    }>;
  };
  matchedClientId: string | null;
  matchedClientName: string | null;
}

interface TaskCreationState {
  open: boolean;
  item: OrgFeedItem | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  clientId: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

const priorityConfig = {
  low: { label: "Low", className: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-600" },
  high: { label: "High", className: "bg-orange-100 text-orange-600" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-600" },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function OrgFeedPage() {
  const [items, setItems] = useState<OrgFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "calls" | "emails">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [taskDialog, setTaskDialog] = useState<TaskCreationState>({
    open: false,
    item: null,
    title: "",
    description: "",
    priority: "medium",
    clientId: null,
  });
  const [creatingTask, setCreatingTask] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Fetch clients list
  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const response = await fetch("/api/clients?limit=100");
      if (response.ok) {
        const data = await response.json();
        const clientOptions = (data.clients || []).map((c: { id: string; first_name: string; last_name: string }) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`.trim(),
        }));
        setClients(clientOptions);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  // Fetch feed items
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/org-feed?type=${filter}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      } else {
        toast.error("Failed to load feed");
      }
    } catch (error) {
      console.error("Error fetching feed:", error);
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Toggle item expansion
  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Open task creation dialog
  const openTaskDialog = (item: OrgFeedItem) => {
    const defaultTitle = item.type === "call"
      ? `Follow up: ${item.from.name || item.from.identifier}`
      : `Re: ${item.emailData?.subject || "Email"}`;

    const defaultDescription = item.summary || "";

    setTaskDialog({
      open: true,
      item,
      title: defaultTitle,
      description: defaultDescription,
      priority: item.priority,
      clientId: item.matchedClientId,
    });

    // Fetch clients when dialog opens
    if (clients.length === 0) {
      fetchClients();
    }
  };

  // Create task
  const handleCreateTask = async () => {
    if (!taskDialog.item || !taskDialog.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setCreatingTask(true);
    try {
      const response = await fetch("/api/tasks/from-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskDialog.title,
          description: taskDialog.description,
          priority: taskDialog.priority,
          type: "follow_up",
          sourceType: taskDialog.item.type === "call" ? "phone_call" : "email",
          sourceId: taskDialog.item.id,
          clientId: taskDialog.clientId,
        }),
      });

      if (response.ok) {
        toast.success("Task created successfully");
        setTaskDialog({ open: false, item: null, title: "", description: "", priority: "medium", clientId: null });
        // Mark item as having a task
        setItems((prev) =>
          prev.map((i) =>
            i.id === taskDialog.item?.id ? { ...i, hasTask: true } : i
          )
        );
      } else {
        toast.error("Failed to create task");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  };

  // Filter items by search
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.from.name?.toLowerCase().includes(query) ||
      item.from.identifier.toLowerCase().includes(query) ||
      item.summary?.toLowerCase().includes(query) ||
      item.emailData?.subject?.toLowerCase().includes(query)
    );
  });

  // Stats
  const callCount = items.filter((i) => i.type === "call").length;
  const emailCount = items.filter((i) => i.type === "email").length;
  const pendingCount = items.filter((i) => !i.hasTask).length;

  return (
    <>
      <Header title="Org Feed" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="border-b bg-card flex-shrink-0">
          <div className="h-12 flex items-center px-4 gap-4">
            {/* Filter Tabs */}
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="gap-2 px-3">
                  All
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {items.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="calls" className="gap-2 px-3">
                  <Phone className="h-4 w-4" />
                  Calls
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {callCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="emails" className="gap-2 px-3">
                  <Mail className="h-4 w-4" />
                  Emails
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {emailCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] h-8 text-sm"
              />
            </div>

            {/* Refresh */}
            <Button variant="ghost" size="sm" className="h-8" onClick={fetchFeed}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            {/* Stats */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{pendingCount} need action</Badge>
            </div>
          </div>
        </div>

        {/* Feed Content */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No items in feed</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Calls and emails will appear here as they come in.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <FeedItemCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedItems.has(item.id)}
                  onToggleExpand={() => toggleExpanded(item.id)}
                  onCreateTask={() => openTaskDialog(item)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Task Creation Dialog */}
      <Dialog open={taskDialog.open} onOpenChange={(open) => !open && setTaskDialog({ ...taskDialog, open: false })}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {taskDialog.item && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                {taskDialog.item.type === "call" ? (
                  <Phone className="h-4 w-4" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                <span>From {taskDialog.item.from.name || taskDialog.item.from.identifier}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={taskDialog.title}
                onChange={(e) => setTaskDialog({ ...taskDialog, title: e.target.value })}
                placeholder="Task title..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskDialog.description}
                onChange={(e) => setTaskDialog({ ...taskDialog, description: e.target.value })}
                placeholder="Task description..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={taskDialog.priority}
                onValueChange={(v) => setTaskDialog({ ...taskDialog, priority: v as typeof taskDialog.priority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link to Client</Label>
              <Select
                value={taskDialog.clientId || "__none__"}
                onValueChange={(v) => setTaskDialog({ ...taskDialog, clientId: v === "__none__" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">No client</span>
                  </SelectItem>
                  {loadingClients ? (
                    <SelectItem value="__loading__" disabled>
                      <span className="text-muted-foreground">Loading clients...</span>
                    </SelectItem>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          {client.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {taskDialog.item?.matchedClientName && taskDialog.clientId === taskDialog.item.matchedClientId && (
                <p className="text-xs text-muted-foreground">
                  Auto-matched from {taskDialog.item.type === "call" ? "caller" : "sender"}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialog({ ...taskDialog, open: false })}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={creatingTask}>
              {creatingTask ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ListTodo className="h-4 w-4 mr-2" />
              )}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Feed Item Card Component
function FeedItemCard({
  item,
  isExpanded,
  onToggleExpand,
  onCreateTask,
}: {
  item: OrgFeedItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCreateTask: () => void;
}) {
  const isCall = item.type === "call";

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      item.hasTask && "border-green-200 bg-green-50/30"
    )}>
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            {/* Type Icon */}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isCall ? "bg-blue-100" : "bg-purple-100"
            )}>
              {isCall ? (
                item.callData?.direction === "outbound" ? (
                  <PhoneOutgoing className="h-5 w-5 text-blue-600" />
                ) : (
                  <PhoneIncoming className="h-5 w-5 text-blue-600" />
                )
              ) : (
                <Mail className="h-5 w-5 text-purple-600" />
              )}
            </div>

            {/* Contact Info */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {item.from.name || item.from.identifier}
                </span>
                {item.matchedClientName && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Building2 className="h-3 w-3" />
                    {item.matchedClientName}
                  </Badge>
                )}
                {item.hasTask && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-green-100 text-green-700 border-green-300">
                    <CheckCircle className="h-3 w-3" />
                    Has Task
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isCall ? (
                  <>
                    <span>{item.from.identifier}</span>
                    {item.callData?.duration && (
                      <>
                        <span>•</span>
                        <span>{formatDuration(item.callData.duration)}</span>
                      </>
                    )}
                  </>
                ) : (
                  <span>{item.emailData?.subject}</span>
                )}
              </div>
            </div>
          </div>

          {/* Timestamp and Priority */}
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary" className={cn("text-[10px]", priorityConfig[item.priority].className)}>
              {priorityConfig[item.priority].label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* AI Summary */}
        {item.summary && (
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Sparkles className="h-3 w-3" />
              AI Summary
            </div>
            <p className="text-sm">{item.summary}</p>
          </div>
        )}

        {/* Action Items Preview */}
        {((isCall && item.callData?.actionItems?.length) || (!isCall && item.emailData?.actionItems?.length)) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {isCall
              ? item.callData?.actionItems.slice(0, 3).map((action, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {action}
                  </Badge>
                ))
              : item.emailData?.actionItems.slice(0, 3).map((action) => (
                  <Badge key={action.id} variant="outline" className="text-xs">
                    {action.title}
                  </Badge>
                ))}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                More
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {!item.hasTask && (
              <Button size="sm" onClick={onCreateTask}>
                <ListTodo className="h-4 w-4 mr-1.5" />
                Create Task
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {isCall && item.callData && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Direction:</span>
                    <span className="ml-2 capitalize">{item.callData.direction}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2 capitalize">{item.callData.status}</span>
                  </div>
                  {item.callData.category && (
                    <div>
                      <span className="text-muted-foreground">Category:</span>
                      <span className="ml-2 capitalize">{item.callData.category.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  {item.callData.sentiment && (
                    <div>
                      <span className="text-muted-foreground">Sentiment:</span>
                      <span className="ml-2 capitalize">{item.callData.sentiment}</span>
                    </div>
                  )}
                </div>
                {item.callData.recordingUrl && (
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Recording available</span>
                  </div>
                )}
              </>
            )}
            {!isCall && item.emailData && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <span className="ml-2 capitalize">{item.emailData.category.replace(/_/g, " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Needs Response:</span>
                    <span className="ml-2">{item.emailData.requiresResponse ? "Yes" : "No"}</span>
                  </div>
                </div>
                {item.emailData.actionItems.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Action Items:</span>
                    <ul className="mt-1 space-y-1">
                      {item.emailData.actionItems.map((action) => (
                        <li key={action.id} className="flex items-center gap-2 text-sm">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          {action.title}
                          <Badge variant="outline" className="text-[10px]">{action.type}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
