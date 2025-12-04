"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Download,
  Trash2,
  Star,
  StarOff,
  Share2,
  Edit3,
  MoreHorizontal,
  Eye,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  Folder,
  FolderPlus,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFiles } from "@/lib/files";
import { FileRecord, formatFileSize, getFileCategory } from "@/lib/files/types";
import { FilePreview } from "./file-preview";

// File icon mapping
const getFileIcon = (mimeType: string) => {
  const category = getFileCategory(mimeType);
  const iconMap: Record<string, typeof File> = {
    image: FileImage,
    pdf: FileText,
    document: FileText,
    spreadsheet: FileSpreadsheet,
    video: FileVideo,
    audio: FileAudio,
    other: File,
  };
  return iconMap[category] || File;
};

interface ClientFilesProps {
  clientId: string;
  clientName: string;
  compact?: boolean;
}

export function ClientFiles({ clientId, clientName, compact = false }: ClientFilesProps) {
  const {
    files,
    folders,
    uploads,
    isLoading,
    uploadFiles,
    downloadFile,
    deleteFile,
    renameFile,
    starFile,
    createFolder,
    navigateToFolder,
    currentFolder,
  } = useFiles();

  const [clientFolder, setClientFolder] = useState<string | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find or create client folder
  useEffect(() => {
    const findClientFolder = async () => {
      // Look for existing client folder
      const existingFolder = folders.find(
        f => f.folderType === "client" && f.clientId === clientId
      );

      if (existingFolder) {
        setClientFolder(existingFolder.id);
        navigateToFolder(existingFolder.id);
      } else {
        // Create client folder if it doesn't exist
        const newFolder = await createFolder(clientName, undefined, "client");
        if (newFolder) {
          setClientFolder(newFolder.id);
          navigateToFolder(newFolder.id);
        }
      }
    };

    if (clientId) {
      findClientFolder();
    }
  }, [clientId, clientName, folders, createFolder, navigateToFolder]);

  // Filter files for this client
  const clientFiles = files.filter(
    f => f.folderId === clientFolder || f.clientId === clientId
  );

  // Handle file upload
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      uploadFiles(Array.from(selectedFiles), clientFolder || undefined, clientId);
    }
    e.target.value = "";
  }, [uploadFiles, clientFolder, clientId]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      uploadFiles(Array.from(droppedFiles), clientFolder || undefined, clientId);
    }
  }, [uploadFiles, clientFolder, clientId]);

  // Handle create folder
  const handleCreateFolder = useCallback(async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim(), clientFolder || undefined, "client");
      setNewFolderName("");
      setShowNewFolderDialog(false);
    }
  }, [newFolderName, createFolder, clientFolder]);

  // Handle rename
  const handleRename = useCallback(async () => {
    if (renameTarget && renameTarget.name.trim()) {
      await renameFile(renameTarget.id, renameTarget.name);
      setRenameTarget(null);
      setShowRenameDialog(false);
    }
  }, [renameTarget, renameFile]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteFile(deleteTarget.id);
      setDeleteTarget(null);
      setShowDeleteDialog(false);
    }
  }, [deleteTarget, deleteFile]);

  // Open preview
  const openPreview = (file: FileRecord) => {
    setPreviewFile(file);
    setShowPreview(true);
  };

  // Navigate preview
  const navigatePreview = (direction: "next" | "prev") => {
    if (!previewFile) return;
    const currentIndex = clientFiles.findIndex(f => f.id === previewFile.id);
    if (currentIndex === -1) return;

    const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < clientFiles.length) {
      setPreviewFile(clientFiles[newIndex]);
    }
  };

  if (compact) {
    // Compact view for overview tab
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Recent Files</CardTitle>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clientFiles.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Folder className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clientFiles.slice(0, 5).map((file) => {
                const FileIcon = getFileIcon(file.mimeType);
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => openPreview(file)}
                  >
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.sizeBytes)} • {format(file.createdAt, "MMM d")}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {
                      e.stopPropagation();
                      downloadFile(file.id);
                    }}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {clientFiles.length > 5 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  +{clientFiles.length - 5} more files
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full view for documents tab
  return (
    <>
      <Card
        className="relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop Zone Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-10 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <Upload className="h-10 w-10 text-primary mx-auto mb-2" />
              <p className="text-lg font-medium">Drop files to upload</p>
            </div>
          </div>
        )}

        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Client Files</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowNewFolderDialog(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </CardHeader>

        {/* Upload Progress */}
        {uploads.length > 0 && (
          <div className="px-6 pb-4 space-y-2">
            {uploads.map((upload) => (
              <div key={upload.fileId} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                  {upload.status === "complete" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : upload.status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{upload.fileName}</p>
                  <Progress value={upload.progress} className="h-1 mt-1" />
                </div>
                <span className="text-xs text-muted-foreground">{upload.progress}%</span>
              </div>
            ))}
          </div>
        )}

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : clientFiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                <Folder className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No files yet</h3>
              <p className="text-sm mb-4">
                Upload files or drag and drop them here
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientFiles.map((file) => {
                  const FileIcon = getFileIcon(file.mimeType);
                  return (
                    <TableRow
                      key={file.id}
                      className="cursor-pointer"
                      onClick={() => openPreview(file)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <FileIcon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{file.name}</span>
                          {file.isStarred && (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(file.sizeBytes)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {file.fileExtension?.toUpperCase() || getFileCategory(file.mimeType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(file.createdAt, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              openPreview(file);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(file.id);
                            }}>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              starFile(file.id, !file.isStarred);
                            }}>
                              {file.isStarred ? (
                                <>
                                  <StarOff className="h-4 w-4 mr-2" />
                                  Remove Star
                                </>
                              ) : (
                                <>
                                  <Star className="h-4 w-4 mr-2" />
                                  Add Star
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget({ id: file.id, name: file.name });
                              setShowRenameDialog(true);
                            }}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ id: file.id, name: file.name });
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="Enter folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">New Name</Label>
              <Input
                id="new-name"
                value={renameTarget?.name || ""}
                onChange={(e) => setRenameTarget(prev => prev ? { ...prev, name: e.target.value } : null)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete File?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview */}
      <FilePreview
        file={previewFile}
        open={showPreview}
        onOpenChange={setShowPreview}
        onNext={() => navigatePreview("next")}
        onPrevious={() => navigatePreview("prev")}
        hasNext={previewFile ? clientFiles.findIndex(f => f.id === previewFile.id) < clientFiles.length - 1 : false}
        hasPrevious={previewFile ? clientFiles.findIndex(f => f.id === previewFile.id) > 0 : false}
      />
    </>
  );
}
