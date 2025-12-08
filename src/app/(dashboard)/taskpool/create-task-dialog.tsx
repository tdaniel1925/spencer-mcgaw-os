"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  actionTypes: ActionType[];
  onCreated: () => void;
}

export function CreateTaskDialog({
  open,
  onClose,
  actionTypes,
  onCreated,
}: CreateTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    action_type_id: "",
    client_id: "",
    priority: "medium",
    due_date: "",
    alert_threshold_hours: 24,
  });

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Load clients for dropdown
  useEffect(() => {
    const loadClients = async () => {
      setLoadingClients(true);
      try {
        const response = await fetch("/api/clients?limit=100");
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients || []);
        }
      } catch (error) {
        console.error("Error loading clients:", error);
      } finally {
        setLoadingClients(false);
      }
    };

    if (open) {
      loadClients();
    }
  }, [open]);

  // Filter clients based on search
  const filteredClients = clients.filter((client) => {
    if (!clientSearch) return true;
    const search = clientSearch.toLowerCase();
    return (
      client.first_name?.toLowerCase().includes(search) ||
      client.last_name?.toLowerCase().includes(search) ||
      client.company?.toLowerCase().includes(search)
    );
  });

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setForm({ ...form, client_id: client.id });
    setClientSearch(`${client.first_name} ${client.last_name}`);
    setShowClientDropdown(false);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setForm({ ...form, client_id: "" });
    setClientSearch("");
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!form.action_type_id) {
      toast.error("Action type is required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/taskpool/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          client_id: form.client_id || null,
          due_date: form.due_date || null,
          alert_threshold_hours: form.due_date ? form.alert_threshold_hours : null,
        }),
      });

      if (response.ok) {
        toast.success("Task created successfully");
        setForm({
          title: "",
          description: "",
          action_type_id: "",
          client_id: "",
          priority: "medium",
          due_date: "",
          alert_threshold_hours: 24,
        });
        setSelectedClient(null);
        setClientSearch("");
        onCreated();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to create task");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({
      title: "",
      description: "",
      action_type_id: "",
      client_id: "",
      priority: "medium",
      due_date: "",
      alert_threshold_hours: 24,
    });
    setSelectedClient(null);
    setClientSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Task
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter task title..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter task description..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Action Type */}
          <div className="space-y-2">
            <Label>Action Type *</Label>
            <div className="grid grid-cols-4 gap-2">
              {actionTypes.map((actionType) => (
                <button
                  key={actionType.id}
                  type="button"
                  onClick={() => setForm({ ...form, action_type_id: actionType.id })}
                  className={cn(
                    "p-2 rounded-lg border text-center transition-all",
                    form.action_type_id === actionType.id
                      ? "border-2 border-primary"
                      : "border-muted hover:border-primary/50"
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-md mx-auto mb-1"
                    style={{ backgroundColor: actionType.color }}
                  />
                  <span className="text-xs font-medium">{actionType.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label>Client (Optional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for a client..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                  if (!e.target.value) {
                    handleClearClient();
                  }
                }}
                onFocus={() => setShowClientDropdown(true)}
                className="pl-9"
              />
              {showClientDropdown && clientSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                  {loadingClients ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Loading...
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No clients found
                    </div>
                  ) : (
                    filteredClients.slice(0, 10).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                        onClick={() => handleSelectClient(client)}
                      >
                        <div className="font-medium text-sm">
                          {client.first_name} {client.last_name}
                        </div>
                        {client.company && (
                          <div className="text-xs text-muted-foreground">
                            {client.company}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedClient && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                <span>
                  {selectedClient.first_name} {selectedClient.last_name}
                </span>
                <button
                  type="button"
                  onClick={handleClearClient}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Priority and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm({ ...form, priority: value })}
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
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>

          {/* Alert Threshold - only show when due date is set */}
          {form.due_date && (
            <div className="space-y-2">
              <Label>Alert Reminder</Label>
              <Select
                value={String(form.alert_threshold_hours)}
                onValueChange={(value) => setForm({ ...form, alert_threshold_hours: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="When to remind..." />
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
              <p className="text-xs text-muted-foreground">
                You'll receive alerts when the due date approaches
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
