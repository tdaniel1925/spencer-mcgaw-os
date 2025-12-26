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
  Mail,
  Inbox,
  Clock,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ListTodo,
  CheckCircle,
  Building2,
  ArrowRight,
  Sparkles,
  Paperclip,
  AlertCircle,
  MessageSquare,
  Archive,
  Settings,
  Plus,
  Trash2,
  Link2,
  Unlink,
  ExternalLink,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { cn, safeFormatDistanceToNow } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";

interface InboxItem {
  id: string;
  emailId: string;
  accountId: string;
  accountEmail: string;
  from: {
    name: string;
    email: string;
  };
  subject: string;
  summary: string | null;
  bodyPreview: string | null;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  sentiment: string | null;
  requiresResponse: boolean;
  hasAttachments: boolean;
  receivedAt: string;
  status: "pending" | "approved" | "dismissed" | "delegated";
  hasTask: boolean;
  matchedClientId: string | null;
  matchedClientName: string | null;
  actionItems: Array<{
    id: string;
    title: string;
    type: string;
  }>;
}

interface TaskCreationState {
  open: boolean;
  item: InboxItem | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  clientId: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface EmailAccount {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  isConnected: boolean;
  lastSyncAt: string | null;
  isGlobal: boolean;
  isOwner: boolean;
}

const priorityConfig = {
  low: { label: "Low", className: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-600" },
  high: { label: "High", className: "bg-orange-100 text-orange-600" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-600" },
};

const categoryConfig: Record<string, { label: string; className: string }> = {
  document_request: { label: "Document", className: "bg-blue-100 text-blue-700" },
  question: { label: "Question", className: "bg-purple-100 text-purple-700" },
  payment: { label: "Payment", className: "bg-green-100 text-green-700" },
  appointment: { label: "Appointment", className: "bg-orange-100 text-orange-700" },
  tax_filing: { label: "Tax Filing", className: "bg-red-100 text-red-700" },
  follow_up: { label: "Follow Up", className: "bg-pink-100 text-pink-700" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700" },
  other: { label: "Other", className: "bg-gray-100 text-gray-700" },
};

export default function MyInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "dismissed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [accountCount, setAccountCount] = useState(0);
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

  // Email account management state
  const [accountsSheetOpen, setAccountsSheetOpen] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState<EmailAccount | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Fetch email accounts
  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch("/api/email/accounts");
      if (response.ok) {
        const data = await response.json();
        // Show all accounts owned by the user (both personal and organization)
        const ownedAccounts = (data.accounts || []).filter(
          (a: EmailAccount) => a.isOwner
        );
        setEmailAccounts(ownedAccounts);
      }
    } catch (error) {
      console.error("Error fetching email accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  // Update account type (Personal/Organization)
  const handleAccountTypeChange = async (account: EmailAccount, isGlobal: boolean) => {
    try {
      const response = await fetch(`/api/email/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGlobal }),
      });
      if (response.ok) {
        toast.success(isGlobal ? "Account set to Organization" : "Account set to Personal");
        // Update local state
        setEmailAccounts((prev) =>
          prev.map((a) => (a.id === account.id ? { ...a, isGlobal } : a))
        );
        // Refresh inbox since emails may have moved
        fetchInbox();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update account type");
      }
    } catch (error) {
      console.error("Error updating account type:", error);
      toast.error("Failed to update account type");
    }
  };

  // Disconnect email account
  const handleDisconnect = async (account: EmailAccount) => {
    setDisconnecting(true);
    try {
      const response = await fetch(`/api/email/accounts/${account.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success(`Disconnected ${account.email}`);
        setDisconnectConfirm(null);
        // Refresh accounts and inbox
        fetchAccounts();
        fetchInbox();
      } else {
        toast.error("Failed to disconnect account");
      }
    } catch (error) {
      console.error("Error disconnecting account:", error);
      toast.error("Failed to disconnect account");
    } finally {
      setDisconnecting(false);
    }
  };

  // Connect new email account
  const handleConnectEmail = () => {
    // Redirect to Microsoft OAuth
    window.location.href = "/api/email/connect";
  };

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

  // Fetch inbox items
  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      params.set("limit", "100");

      const response = await fetch(`/api/my-inbox?${params}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
        setAccountCount(data.accountCount || 0);
      } else {
        toast.error("Failed to load inbox");
      }
    } catch (error) {
      console.error("Error fetching inbox:", error);
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

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
  const openTaskDialog = (item: InboxItem) => {
    setTaskDialog({
      open: true,
      item,
      title: `Re: ${item.subject}`,
      description: item.summary || "",
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
          type: "email",
          sourceType: "email",
          sourceId: taskDialog.item.emailId,
          clientId: taskDialog.clientId,
        }),
      });

      if (response.ok) {
        toast.success("Task created successfully");
        setTaskDialog({ open: false, item: null, title: "", description: "", priority: "medium", clientId: null });
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

  // Dismiss email
  const handleDismiss = async (item: InboxItem) => {
    try {
      const response = await fetch(`/api/email-intelligence/${item.id}/dismiss`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Email dismissed");
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "dismissed" as const } : i
          )
        );
      }
    } catch (error) {
      console.error("Error dismissing email:", error);
      toast.error("Failed to dismiss email");
    }
  };

  // Filter items by search
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.from.name?.toLowerCase().includes(query) ||
      item.from.email.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query) ||
      item.summary?.toLowerCase().includes(query)
    );
  });

  // Stats
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const needsResponseCount = items.filter((i) => i.requiresResponse && i.status === "pending").length;

  return (
    <>
      <Header title="My Inbox" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="border-b bg-card flex-shrink-0">
          <div className="h-12 flex items-center px-4 gap-4">
            {/* Status Tabs */}
            <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="gap-2 px-3">
                  All
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {items.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2 px-3">
                  Pending
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {pendingCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="approved" className="gap-2 px-3">
                  <CheckCircle className="h-4 w-4" />
                  Processed
                </TabsTrigger>
                <TabsTrigger value="dismissed" className="gap-2 px-3">
                  <Archive className="h-4 w-4" />
                  Dismissed
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
            <Button variant="ghost" size="sm" className="h-8" onClick={fetchInbox}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            {/* Account Management */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => {
                setAccountsSheetOpen(true);
                if (emailAccounts.length === 0) {
                  fetchAccounts();
                }
              }}
            >
              <Settings className="h-4 w-4" />
              Accounts
              {accountCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {accountCount}
                </Badge>
              )}
            </Button>

            {/* Stats */}
            {needsResponseCount > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <MessageSquare className="h-3 w-3 mr-1" />
                {needsResponseCount} need response
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : accountCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No email accounts connected</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  Connect your personal email account to see your inbox here.
                </p>
                <Button className="mt-4" onClick={handleConnectEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Email
                </Button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Your inbox is empty</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  New emails will appear here as they are synced.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <InboxItemCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedItems.has(item.id)}
                  onToggleExpand={() => toggleExpanded(item.id)}
                  onCreateTask={() => openTaskDialog(item)}
                  onDismiss={() => handleDismiss(item)}
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
            <DialogTitle>Create Task from Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {taskDialog.item && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                <Mail className="h-4 w-4" />
                <span className="truncate">From {taskDialog.item.from.name || taskDialog.item.from.email}</span>
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
                  Auto-matched from sender
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

      {/* Email Account Management Sheet */}
      <Sheet open={accountsSheetOpen} onOpenChange={setAccountsSheetOpen}>
        <SheetContent className="w-full sm:max-w-md p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Accounts
            </SheetTitle>
            <SheetDescription>
              Manage your connected email accounts for My Inbox
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            {/* Connect New Account Button */}
            <Button
              className="w-full gap-2"
              onClick={handleConnectEmail}
            >
              <Plus className="h-4 w-4" />
              Connect Email Account
            </Button>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Connected Accounts</h4>

              {loadingAccounts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : emailAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No email accounts connected yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connect your Microsoft 365 email to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-3 rounded-lg border bg-card space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            account.isConnected ? "bg-green-100" : "bg-amber-100"
                          )}>
                            <Mail className={cn(
                              "h-5 w-5",
                              account.isConnected ? "text-green-600" : "text-amber-600"
                            )} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {account.displayName || account.email}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {account.isConnected ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <Link2 className="h-3 w-3" />
                                  Connected
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <AlertCircle className="h-3 w-3" />
                                  Expired
                                </span>
                              )}
                              {account.lastSyncAt && (
                                <span>
                                  • Synced {safeFormatDistanceToNow(account.lastSyncAt, { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDisconnectConfirm(account)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Account Type Selector */}
                      <div className="flex items-center justify-between pl-13">
                        <span className="text-xs text-muted-foreground">Route emails to:</span>
                        <Select
                          value={account.isGlobal ? "organization" : "personal"}
                          onValueChange={(value) => handleAccountTypeChange(account, value === "organization")}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="personal">
                              <div className="flex items-center gap-2">
                                <Inbox className="h-3 w-3" />
                                My Inbox
                              </div>
                            </SelectItem>
                            <SelectItem value="organization">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3 w-3" />
                                Org Feed
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Help text */}
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                <strong>Personal accounts</strong> → emails appear in <strong>My Inbox</strong> (private to you)
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Organization accounts</strong> → emails appear in <strong>Org Feed</strong> (visible to team)
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={!!disconnectConfirm} onOpenChange={(open) => !open && setDisconnectConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Email Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect <strong>{disconnectConfirm?.email}</strong> and remove all
              associated email data, classifications, and action items from the system.
              Tasks created from emails will be preserved. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectConfirm && handleDisconnect(disconnectConfirm)}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4 mr-2" />
              )}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Inbox Item Card Component
function InboxItemCard({
  item,
  isExpanded,
  onToggleExpand,
  onCreateTask,
  onDismiss,
}: {
  item: InboxItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCreateTask: () => void;
  onDismiss: () => void;
}) {
  const category = categoryConfig[item.category] || categoryConfig.other;

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      item.hasTask && "border-green-200 bg-green-50/30",
      item.status === "dismissed" && "opacity-60"
    )}>
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Email Icon */}
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>

            {/* From and Subject */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">
                  {item.from.name || item.from.email}
                </span>
                {item.matchedClientName && (
                  <Badge variant="outline" className="text-[10px] gap-1 flex-shrink-0">
                    <Building2 className="h-3 w-3" />
                    {item.matchedClientName}
                  </Badge>
                )}
                {item.hasTask && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-green-100 text-green-700 border-green-300 flex-shrink-0">
                    <CheckCircle className="h-3 w-3" />
                    Has Task
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {item.subject}
              </div>
            </div>
          </div>

          {/* Status and Time */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={cn("text-[10px]", category.className)}>
                {category.label}
              </Badge>
              <Badge variant="secondary" className={cn("text-[10px]", priorityConfig[item.priority].className)}>
                {priorityConfig[item.priority].label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.hasAttachments && <Paperclip className="h-3 w-3" />}
              {item.requiresResponse && <MessageSquare className="h-3 w-3 text-amber-500" />}
              <span>{safeFormatDistanceToNow(item.receivedAt, { addSuffix: true })}</span>
            </div>
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
        {item.actionItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {item.actionItems.slice(0, 3).map((action) => (
              <Badge key={action.id} variant="outline" className="text-xs">
                {action.title}
              </Badge>
            ))}
            {item.actionItems.length > 3 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{item.actionItems.length - 3} more
              </Badge>
            )}
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
            {item.status === "pending" && (
              <>
                <Button variant="ghost" size="sm" onClick={onDismiss}>
                  <Archive className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
                {!item.hasTask && (
                  <Button size="sm" onClick={onCreateTask}>
                    <ListTodo className="h-4 w-4 mr-1.5" />
                    Create Task
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">From:</span>
                <span className="ml-2">{item.from.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Account:</span>
                <span className="ml-2">{item.accountEmail}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Received:</span>
                <span className="ml-2">{format(new Date(item.receivedAt), "MMM d, yyyy h:mm a")}</span>
              </div>
              {item.sentiment && (
                <div>
                  <span className="text-muted-foreground">Sentiment:</span>
                  <span className="ml-2 capitalize">{item.sentiment}</span>
                </div>
              )}
            </div>

            {item.bodyPreview && (
              <div className="bg-muted/30 rounded-lg p-3">
                <span className="text-xs text-muted-foreground block mb-1">Preview:</span>
                <p className="text-sm whitespace-pre-wrap">{item.bodyPreview}</p>
              </div>
            )}

            {item.actionItems.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Action Items:</span>
                <ul className="mt-1 space-y-1">
                  {item.actionItems.map((action) => (
                    <li key={action.id} className="flex items-center gap-2 text-sm">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {action.title}
                      <Badge variant="outline" className="text-[10px]">{action.type}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
