"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Download,
  RotateCcw,
  Loader2,
  FileText,
  User,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/files/types";

interface FileVersion {
  id: string;
  version_number: number;
  size_bytes: number;
  checksum: string | null;
  change_summary: string | null;
  created_at: string;
  created_by: string | null;
  users?: {
    full_name: string;
    email: string;
  };
}

interface VersionHistoryDialogProps {
  fileId: string | null;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVersionRestored?: () => void;
}

export function VersionHistoryDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
  onVersionRestored,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);

  useEffect(() => {
    if (open && fileId) {
      fetchVersions();
    }
  }, [open, fileId]);

  const fetchVersions = async () => {
    if (!fileId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/files/${fileId}/versions`);

      if (!response.ok) {
        throw new Error("Failed to fetch versions");
      }

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (error) {
      console.error("Version fetch error:", error);
      toast.error("Failed to load version history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (versionId: string, versionNumber: number) => {
    if (!fileId) return;

    setRestoringVersion(versionId);
    try {
      const response = await fetch(
        `/api/files/${fileId}/versions/${versionId}/restore`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to restore version");
      }

      const data = await response.json();
      toast.success(
        `Restored to version ${versionNumber}. New version: ${data.newVersion}`
      );

      // Refresh versions list
      await fetchVersions();

      // Notify parent
      onVersionRestored?.();
    } catch (error) {
      console.error("Restore error:", error);
      toast.error("Failed to restore version");
    } finally {
      setRestoringVersion(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>
            {fileName} • {versions.length} version{versions.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Version History</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                This file hasn't been modified yet. Version history will appear here
                when you update the file.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => {
                const isLatest = index === 0;
                const isRestoring = restoringVersion === version.id;

                return (
                  <div
                    key={version.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Version number and badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-sm">
                            Version {version.version_number}
                          </span>
                          {isLatest && (
                            <Badge variant="default" className="h-5">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Current
                            </Badge>
                          )}
                        </div>

                        {/* Change summary */}
                        {version.change_summary && (
                          <p className="text-sm text-muted-foreground mb-2 flex items-start gap-2">
                            <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{version.change_summary}</span>
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(version.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.users?.full_name || "Unknown"}
                          </span>
                          <span>{formatFileSize(version.size_bytes)}</span>
                          <span className="text-xs font-mono">
                            {format(new Date(version.created_at), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      {!isLatest && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleRestore(version.id, version.version_number)
                            }
                            disabled={isRestoring}
                          >
                            {isRestoring ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Restoring...
                              </>
                            ) : (
                              <>
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Restore
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
