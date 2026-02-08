"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Upload, X, FileIcon } from "lucide-react";

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communicationId: string;
  communicationType: "phone" | "email";
  communicationSubject: string;
  onAssignmentComplete?: () => void;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export function AssignmentDialog({
  open,
  onOpenChange,
  communicationId,
  communicationType,
  communicationSubject,
  onAssignmentComplete,
}: AssignmentDialogProps) {
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [instructions, setInstructions] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);

  // Fetch team members when dialog opens
  const fetchTeamMembers = useCallback(async () => {
    setIsLoadingTeam(true);
    try {
      const response = await fetch("/api/users?role=all&active=true");
      if (!response.ok) throw new Error("Failed to fetch team members");
      const data = await response.json();
      setTeamMembers(data.users || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setIsLoadingTeam(false);
    }
  }, []);

  // Load team members when dialog opens
  useState(() => {
    if (open && teamMembers.length === 0) {
      fetchTeamMembers();
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAssign = async () => {
    if (!assigneeId) {
      toast.error("Please select a team member to assign to");
      return;
    }

    setIsLoading(true);

    try {
      // Upload attachments first (if any)
      let attachmentUrls: string[] = [];
      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach((file) => {
          formData.append("files", file);
        });

        const uploadResponse = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload attachments");
        }

        const uploadData = await uploadResponse.json();
        attachmentUrls = uploadData.urls || [];
      }

      // Create assignment (task)
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Follow up: ${communicationSubject}`,
          description: instructions || `Follow up on this ${communicationType}.`,
          priority: "medium",
          assignedTo: assigneeId,
          sourceType: communicationType === "phone" ? "phone_call" : "email",
          sourceId: communicationId,
          attachmentUrls,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create assignment");
      }

      const assignee = teamMembers.find((m) => m.id === assigneeId);
      toast.success(`Assigned to ${assignee?.name || "team member"}`);

      // Reset form
      setAssigneeId("");
      setInstructions("");
      setAttachments([]);
      onOpenChange(false);

      // Callback to refresh parent data
      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
    } catch (error) {
      console.error("Assignment error:", error);
      toast.error("Failed to create assignment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Communication</DialogTitle>
          <DialogDescription>
            Assign this {communicationType} to a team member with optional instructions and
            attachments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Communication Subject */}
          <div className="space-y-2">
            <Label>Communication</Label>
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
              {communicationSubject}
            </div>
          </div>

          {/* Assignee Selector */}
          <div className="space-y-2">
            <Label htmlFor="assignee">Assign To *</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId} disabled={isLoadingTeam}>
              <SelectTrigger id="assignee">
                <SelectValue placeholder={isLoadingTeam ? "Loading team..." : "Select team member"} />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions (Optional)</Label>
            <Textarea
              id="instructions"
              placeholder="Add any specific instructions or context for the assignee..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label htmlFor="attachments">Attachments (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="attachments"
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("attachments")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Files
              </Button>
              <span className="text-sm text-muted-foreground">
                {attachments.length} file{attachments.length !== 1 ? "s" : ""} selected
              </span>
            </div>

            {/* Attachment List */}
            {attachments.length > 0 && (
              <div className="space-y-1 mt-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-muted p-2 rounded-md text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isLoading || !assigneeId}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
