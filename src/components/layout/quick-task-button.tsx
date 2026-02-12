"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { z } from "zod";

// Validation schema
const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  assigned_to: z.string().uuid("Please select a user"),
});

interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function QuickTaskButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  // Fetch users when popover opens
  useEffect(() => {
    if (open && users.length === 0) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch("/api/users?taskpool=true");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      toast.error("Failed to load users", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateTask = async () => {
    // Validate inputs
    const validation = createTaskSchema.safeParse({
      title,
      assigned_to: selectedUserId,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      toast.error("Validation Error", {
        description: firstError.message,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          assigned_to: selectedUserId,
          status: "open",
          priority: "medium",
          source_type: "manual",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create task");
      }

      const data = await response.json();

      // Find the assigned user's name for the toast
      const assignedUser = users.find(u => u.id === selectedUserId);
      const assignedUserName = assignedUser?.full_name || assignedUser?.email || "user";

      toast.success("Task Created", {
        description: `"${title}" assigned to ${assignedUserName}`,
      });

      // Reset form and close popover
      setTitle("");
      setSelectedUserId("");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to create task", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const getUserInitials = (user: User) => {
    if (user.full_name) {
      return user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
          aria-label="Create quick task"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-sm mb-1">Quick Task</h3>
            <p className="text-xs text-muted-foreground">
              Create a task and assign it to a team member
            </p>
          </div>

          <div className="space-y-3">
            {/* Task Title Input */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-sm">
                Task Title
              </Label>
              <Input
                id="task-title"
                placeholder="Enter task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title && selectedUserId) {
                    handleCreateTask();
                  }
                }}
              />
            </div>

            {/* User Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="assign-to" className="text-sm">
                Assign To
              </Label>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading users...</span>
                </div>
              ) : (
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={loading || users.length === 0}
                >
                  <SelectTrigger id="assign-to">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No users available
                      </div>
                    ) : (
                      users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={user.avatar_url || ""} alt={user.full_name || ""} />
                              <AvatarFallback className="text-xs">
                                {getUserInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">
                              {user.full_name || user.email}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleCreateTask}
              disabled={loading || !title.trim() || !selectedUserId}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
