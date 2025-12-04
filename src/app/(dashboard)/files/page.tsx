"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Upload,
  Download,
  Trash2,
  Star,
  StarOff,
  Share2,
  Copy,
  Scissors,
  ClipboardPaste,
  Edit3,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Home,
  Clock,
  Search,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Filter,
  Users,
  Building2,
  Lock,
  Globe,
  Eye,
  Link2,
  X,
  Loader2,
  HardDrive,
  FolderLock,
  FolderHeart,
  ArrowUpDown,
  RefreshCw,
  Info,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { useFiles } from "@/lib/files";
import { Folder as FolderType, FileRecord, formatFileSize, getFileCategory } from "@/lib/files/types";
import { FilePreview } from "@/components/files/file-preview";

// File type to icon mapping
const getFileIcon = (mimeType: string) => {
  const category = getFileCategory(mimeType);
  const iconMap: Record<string, typeof File> = {
    image: FileImage,
    pdf: FileText,
    document: FileText,
    spreadsheet: FileSpreadsheet,
    presentation: FileText,
    video: FileVideo,
    audio: FileAudio,
    code: FileCode,
    archive: FileArchive,
    other: File,
  };
  return iconMap[category] || File;
};

// Folder type to icon mapping
const getFolderIcon = (type: string, isOpen?: boolean) => {
  if (type === "repository") return FolderLock;
  if (type === "team") return Users;
  if (type === "client") return Building2;
  return isOpen ? FolderOpen : Folder;
};

// View modes
type ViewMode = "grid" | "list";
type SortField = "name" | "date" | "size" | "type";
type SortOrder = "asc" | "desc";

export default function FilesPage() {
  const {
    folders,
    files,
    currentFolder,
    breadcrumbs,
    selectedItems,
    uploads,
    quota,
    isLoading,
    error,
    navigateToFolder,
    navigateUp,
    refreshCurrentFolder,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    uploadFiles,
    downloadFile,
    renameFile,
    moveFile,
    deleteFile,
    starFile,
    createShareLink,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    toggleSelection,
    bulkDelete,
    searchFiles,
    getRecentFiles,
    getStarredFiles,
    getTrashedFiles,
  } = useFiles();

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareTarget, setShareTarget] = useState<FileRecord | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: "file" | "folder" } | null>(null);
  const [activeSection, setActiveSection] = useState<"all" | "recent" | "starred" | "trash">("all");
  const [sectionFiles, setSectionFiles] = useState<FileRecord[]>([]);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sort items
  const sortItems = useCallback(<T extends { name: string; createdAt: Date; sizeBytes?: number; mimeType?: string }>(
    items: T[]
  ): T[] => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "date":
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case "size":
          comparison = (a.sizeBytes || 0) - (b.sizeBytes || 0);
          break;
        case "type":
          comparison = (a.mimeType || "").localeCompare(b.mimeType || "");
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [sortField, sortOrder]);

  // Load section files
  useEffect(() => {
    const loadSectionFiles = async () => {
      if (activeSection === "recent") {
        const recent = await getRecentFiles(20);
        setSectionFiles(recent);
      } else if (activeSection === "starred") {
        const starred = await getStarredFiles();
        setSectionFiles(starred);
      } else if (activeSection === "trash") {
        const trashed = await getTrashedFiles();
        setSectionFiles(trashed);
      } else {
        setSectionFiles([]);
      }
    };
    loadSectionFiles();
  }, [activeSection, getRecentFiles, getStarredFiles, getTrashedFiles]);

  // Handle file upload via input
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      uploadFiles(Array.from(selectedFiles));
    }
    e.target.value = "";
  }, [uploadFiles]);

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
      uploadFiles(Array.from(droppedFiles));
    }
  }, [uploadFiles]);

  // Handle folder creation
  const handleCreateFolder = useCallback(async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolderDialog(false);
    }
  }, [newFolderName, createFolder]);

  // Handle rename
  const handleRename = useCallback(async () => {
    if (renameTarget && renameTarget.name.trim()) {
      if (renameTarget.type === "folder") {
        await renameFolder(renameTarget.id, renameTarget.name);
      } else {
        await renameFile(renameTarget.id, renameTarget.name);
      }
      setRenameTarget(null);
      setShowRenameDialog(false);
    }
  }, [renameTarget, renameFolder, renameFile]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (deleteTarget) {
      if (deleteTarget.type === "folder") {
        await deleteFolder(deleteTarget.id);
      } else {
        await deleteFile(deleteTarget.id);
      }
      setDeleteTarget(null);
      setShowDeleteDialog(false);
    }
  }, [deleteTarget, deleteFolder, deleteFile]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (shareTarget) {
      const share = await createShareLink(shareTarget.id);
      if (share?.shareUrl) {
        await navigator.clipboard.writeText(share.shareUrl);
      }
    }
  }, [shareTarget, createShareLink]);

  // Open file preview
  const openPreview = useCallback((file: FileRecord) => {
    setPreviewFile(file);
    setShowPreview(true);
  }, []);

  // Navigate to next/previous file in preview
  const navigatePreview = useCallback((direction: "next" | "prev") => {
    if (!previewFile) return;
    const currentFiles = activeSection === "all" ? files : sectionFiles;
    const currentIndex = currentFiles.findIndex(f => f.id === previewFile.id);
    if (currentIndex === -1) return;

    const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < currentFiles.length) {
      setPreviewFile(currentFiles[newIndex]);
    }
  }, [previewFile, files, sectionFiles, activeSection]);

  // Open rename dialog
  const openRename = (id: string, name: string, type: "file" | "folder") => {
    setRenameTarget({ id, name, type });
    setShowRenameDialog(true);
  };

  // Open delete dialog
  const openDelete = (id: string, name: string, type: "file" | "folder") => {
    setDeleteTarget({ id, name, type });
    setShowDeleteDialog(true);
  };

  // Get display items based on active section
  const displayFolders = activeSection === "all" ? sortItems(folders) : [];
  const displayFiles = activeSection === "all"
    ? sortItems(files)
    : sortItems(sectionFiles);

  // Sidebar navigation items
  const sidebarItems = [
    { id: "all", label: "All Files", icon: Home, onClick: () => { setActiveSection("all"); navigateToFolder(null); } },
    { id: "recent", label: "Recent", icon: Clock, onClick: () => setActiveSection("recent") },
    { id: "starred", label: "Starred", icon: Star, onClick: () => setActiveSection("starred") },
    { id: "trash", label: "Trash", icon: Trash2, onClick: () => setActiveSection("trash") },
  ];

  return (
    <>
      <Header title="Files" />
      <TooltipProvider>
        <div className="flex h-[calc(100vh-64px)]">
          {/* Sidebar */}
          <aside className="w-64 border-r bg-muted/30 flex flex-col">
            {/* Upload Button */}
            <div className="p-4">
              <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
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

            {/* Navigation */}
            <nav className="flex-1 px-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-1",
                      activeSection === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}

              <Separator className="my-4" />

              {/* Folder Types */}
              <p className="px-3 text-xs font-medium text-muted-foreground mb-2">Folders</p>
              <button
                onClick={() => { setActiveSection("all"); navigateToFolder(null); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Folder className="h-4 w-4" />
                My Files
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Users className="h-4 w-4" />
                Team Files
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <FolderLock className="h-4 w-4" />
                Repository
              </button>
            </nav>

            {/* Storage Quota */}
            {quota && (
              <div className="p-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Storage</span>
                </div>
                <Progress value={quota.percentUsed} className="h-1.5 mb-1" />
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(quota.usedBytes)} of {formatFileSize(quota.quotaBytes)} used
                </p>
              </div>
            )}
          </aside>

          {/* Main Content */}
          <main
            className="flex-1 flex flex-col overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Toolbar */}
            <div className="h-14 border-b bg-card px-4 flex items-center gap-3">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1 text-sm">
                {breadcrumbs.map((item, idx) => (
                  <div key={item.id} className="flex items-center">
                    {idx > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
                    <button
                      onClick={() => navigateToFolder(item.id === "root" ? null : item.id)}
                      className={cn(
                        "hover:text-primary transition-colors",
                        idx === breadcrumbs.length - 1 ? "font-medium" : "text-muted-foreground"
                      )}
                    >
                      {item.name}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex-1" />

              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center border rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-r-none"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-l-none"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortField("name")}>
                    Name {sortField === "name" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField("date")}>
                    Date {sortField === "date" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField("size")}>
                    Size {sortField === "size" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField("type")}>
                    Type {sortField === "type" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
                    {sortOrder === "asc" ? "Descending" : "Ascending"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* New Folder */}
              <Button variant="outline" size="sm" onClick={() => setShowNewFolderDialog(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>

              {/* Refresh */}
              <Button variant="ghost" size="icon" onClick={refreshCurrentFolder}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>

            {/* Selection Bar */}
            {selectedItems.length > 0 && (
              <div className="h-12 border-b bg-primary/5 px-4 flex items-center gap-3">
                <span className="text-sm font-medium">{selectedItems.length} selected</span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="ghost" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => bulkDelete()}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            )}

            {/* Upload Progress */}
            {uploads.length > 0 && (
              <div className="border-b bg-muted/30 p-3">
                <div className="space-y-2">
                  {uploads.map((upload) => (
                    <div key={upload.fileId} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                        {upload.status === "complete" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : upload.status === "error" ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{upload.fileName}</p>
                        <Progress value={upload.progress} className="h-1 mt-1" />
                      </div>
                      <span className="text-xs text-muted-foreground">{upload.progress}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drop Zone Overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-50 flex items-center justify-center">
                <div className="text-center">
                  <Upload className="h-12 w-12 text-primary mx-auto mb-2" />
                  <p className="text-lg font-medium">Drop files to upload</p>
                </div>
              </div>
            )}

            {/* File Grid/List */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : displayFolders.length === 0 && displayFiles.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                      <Folder className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">
                      {activeSection === "all" ? "This folder is empty" : `No ${activeSection} files`}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {activeSection === "all"
                        ? "Upload files or create a folder to get started"
                        : `Files you ${activeSection === "starred" ? "star" : activeSection === "recent" ? "access" : "delete"} will appear here`
                      }
                    </p>
                    {activeSection === "all" && (
                      <div className="flex gap-2 justify-center">
                        <Button onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Files
                        </Button>
                        <Button variant="outline" onClick={() => setShowNewFolderDialog(true)}>
                          <FolderPlus className="h-4 w-4 mr-2" />
                          New Folder
                        </Button>
                      </div>
                    )}
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {/* Folders */}
                    {displayFolders.map((folder) => {
                      const FolderIcon = getFolderIcon(folder.folderType);
                      const isSelected = selectedItems.includes(folder.id);
                      return (
                        <ContextMenu key={folder.id}>
                          <ContextMenuTrigger>
                            <div
                              className={cn(
                                "group relative p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md",
                                isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                              )}
                              onClick={() => navigateToFolder(folder.id)}
                              onDoubleClick={() => navigateToFolder(folder.id)}
                            >
                              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(e) => {
                                    e && toggleSelection(folder.id, "folder");
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <FolderIcon className={cn(
                                  "h-12 w-12",
                                  folder.folderType === "team" ? "text-blue-500" :
                                  folder.folderType === "repository" ? "text-amber-500" :
                                  folder.folderType === "client" ? "text-green-500" :
                                  "text-primary"
                                )} />
                                <p className="text-sm font-medium text-center truncate w-full">{folder.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{folder.folderType}</p>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => navigateToFolder(folder.id)}>
                              <FolderOpen className="h-4 w-4 mr-2" />
                              Open
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => openRename(folder.id, folder.name, "folder")}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Rename
                            </ContextMenuItem>
                            <ContextMenuItem>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-destructive"
                              onClick={() => openDelete(folder.id, folder.name, "folder")}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}

                    {/* Files */}
                    {displayFiles.map((file) => {
                      const FileIcon = getFileIcon(file.mimeType);
                      const isSelected = selectedItems.includes(file.id);
                      return (
                        <ContextMenu key={file.id}>
                          <ContextMenuTrigger>
                            <div
                              className={cn(
                                "group relative p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md",
                                isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                              )}
                              onClick={() => toggleSelection(file.id, "file")}
                              onDoubleClick={() => openPreview(file)}
                            >
                              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelection(file.id, "file")}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              {file.isStarred && (
                                <Star className="absolute top-2 right-2 h-4 w-4 text-amber-500 fill-amber-500" />
                              )}
                              <div className="flex flex-col items-center gap-2">
                                <FileIcon className="h-12 w-12 text-muted-foreground" />
                                <p className="text-sm font-medium text-center truncate w-full">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</p>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => openPreview(file)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => downloadFile(file.id)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => { setShareTarget(file); setShowShareDialog(true); }}>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => starFile(file.id, !file.isStarred)}>
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
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => openRename(file.id, file.name, "file")}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Rename
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-destructive"
                              onClick={() => openDelete(file.id, file.name, "file")}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                ) : (
                  /* List View */
                  <div className="space-y-1">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                      <div className="col-span-6">Name</div>
                      <div className="col-span-2">Modified</div>
                      <div className="col-span-2">Size</div>
                      <div className="col-span-2">Type</div>
                    </div>

                    {/* Folders */}
                    {displayFolders.map((folder) => {
                      const FolderIcon = getFolderIcon(folder.folderType);
                      const isSelected = selectedItems.includes(folder.id);
                      return (
                        <div
                          key={folder.id}
                          className={cn(
                            "grid grid-cols-12 gap-4 px-4 py-3 rounded-lg cursor-pointer transition-colors group",
                            isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                          )}
                          onClick={() => navigateToFolder(folder.id)}
                        >
                          <div className="col-span-6 flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(folder.id, "folder")}
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100"
                            />
                            <FolderIcon className="h-5 w-5 text-primary" />
                            <span className="font-medium truncate">{folder.name}</span>
                          </div>
                          <div className="col-span-2 text-sm text-muted-foreground flex items-center">
                            {format(folder.updatedAt, "MMM d, yyyy")}
                          </div>
                          <div className="col-span-2 text-sm text-muted-foreground flex items-center">
                            —
                          </div>
                          <div className="col-span-2 text-sm text-muted-foreground flex items-center capitalize">
                            {folder.folderType} folder
                          </div>
                        </div>
                      );
                    })}

                    {/* Files */}
                    {displayFiles.map((file) => {
                      const FileIcon = getFileIcon(file.mimeType);
                      const isSelected = selectedItems.includes(file.id);
                      return (
                        <div
                          key={file.id}
                          className={cn(
                            "grid grid-cols-12 gap-4 px-4 py-3 rounded-lg cursor-pointer transition-colors group",
                            isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleSelection(file.id, "file")}
                          onDoubleClick={() => openPreview(file)}
                        >
                          <div className="col-span-6 flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(file.id, "file")}
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100"
                            />
                            <FileIcon className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium truncate">{file.name}</span>
                            {file.isStarred && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                          </div>
                          <div className="col-span-2 text-sm text-muted-foreground flex items-center">
                            {format(file.updatedAt, "MMM d, yyyy")}
                          </div>
                          <div className="col-span-2 text-sm text-muted-foreground flex items-center">
                            {formatFileSize(file.sizeBytes)}
                          </div>
                          <div className="col-span-2 text-sm text-muted-foreground flex items-center">
                            {file.fileExtension?.toUpperCase() || "File"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </main>
        </div>
      </TooltipProvider>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in {currentFolder?.name || "root"}
            </DialogDescription>
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
            <DialogTitle>Rename {renameTarget?.type}</DialogTitle>
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
            <Button onClick={handleRename}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.type}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"?
              {deleteTarget?.type === "folder" && " This will also delete all files inside."}
            </DialogDescription>
          </DialogHeader>
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

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share "{shareTarget?.name}"</DialogTitle>
            <DialogDescription>
              Create a shareable link to this file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1 truncate">
                {typeof window !== "undefined" && `${window.location.origin}/share/...`}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleShare}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Modal */}
      <FilePreview
        file={previewFile}
        open={showPreview}
        onOpenChange={setShowPreview}
        onNext={() => navigatePreview("next")}
        onPrevious={() => navigatePreview("prev")}
        hasNext={previewFile ? displayFiles.findIndex(f => f.id === previewFile.id) < displayFiles.length - 1 : false}
        hasPrevious={previewFile ? displayFiles.findIndex(f => f.id === previewFile.id) > 0 : false}
      />
    </>
  );
}
