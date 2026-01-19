"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Folder,
  FileRecord,
  FileVersion,
  FolderPermission,
  FileShare,
  StorageQuota,
  FileActivity,
  UploadProgress,
  FileFilter,
  FolderType,
  Permission,
  BreadcrumbItem,
  generateSlug,
  DEFAULT_STORAGE_QUOTA_BYTES,
} from "./types";

interface FileContextType {
  // State
  folders: Folder[];
  files: FileRecord[];
  currentFolder: Folder | null;
  breadcrumbs: BreadcrumbItem[];
  selectedItems: string[];
  uploads: UploadProgress[];
  quota: StorageQuota | null;
  isLoading: boolean;
  error: string | null;

  // Navigation
  navigateToFolder: (folderId: string | null) => Promise<void>;
  navigateUp: () => Promise<void>;
  refreshCurrentFolder: () => Promise<void>;

  // Folder operations
  createFolder: (name: string, parentId?: string, type?: FolderType) => Promise<Folder | null>;
  renameFolder: (folderId: string, newName: string) => Promise<boolean>;
  moveFolder: (folderId: string, newParentId: string | null) => Promise<boolean>;
  deleteFolder: (folderId: string) => Promise<boolean>;

  // File operations
  uploadFiles: (files: File[], folderId?: string, clientId?: string) => Promise<FileRecord[]>;
  downloadFile: (fileId: string, getUrlOnly?: boolean) => Promise<string | void>;
  renameFile: (fileId: string, newName: string) => Promise<boolean>;
  moveFile: (fileId: string, newFolderId: string | null) => Promise<boolean>;
  copyFile: (fileId: string, newFolderId: string | null) => Promise<FileRecord | null>;
  deleteFile: (fileId: string, permanent?: boolean) => Promise<boolean>;
  restoreFile: (fileId: string) => Promise<boolean>;
  starFile: (fileId: string, starred: boolean) => Promise<boolean>;

  // Version management
  getFileVersions: (fileId: string) => Promise<FileVersion[]>;
  restoreVersion: (fileId: string, versionId: string) => Promise<boolean>;

  // Sharing
  createShareLink: (fileId: string, options?: Partial<FileShare>) => Promise<FileShare | null>;
  getShareLinks: (fileId: string) => Promise<FileShare[]>;
  revokeShareLink: (shareId: string) => Promise<boolean>;

  // Permissions
  getFolderPermissions: (folderId: string) => Promise<FolderPermission[]>;
  setFolderPermission: (folderId: string, userId: string, permission: Permission) => Promise<boolean>;
  removeFolderPermission: (folderId: string, userId: string) => Promise<boolean>;

  // Selection
  selectItem: (itemId: string, type: "file" | "folder") => void;
  deselectItem: (itemId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleSelection: (itemId: string, type: "file" | "folder") => void;

  // Bulk operations
  bulkMove: (targetFolderId: string | null) => Promise<boolean>;
  bulkDelete: (permanent?: boolean) => Promise<boolean>;
  bulkDownload: () => Promise<void>;

  // Search and filter
  searchFiles: (query: string, filter?: FileFilter) => Promise<FileRecord[]>;
  getRecentFiles: (limit?: number) => Promise<FileRecord[]>;
  getStarredFiles: () => Promise<FileRecord[]>;
  getTrashedFiles: () => Promise<FileRecord[]>;

  // Trash management
  emptyTrash: () => Promise<{ success: boolean; deletedCount: number }>;

  // Activity
  getFileActivity: (fileId: string) => Promise<FileActivity[]>;

  // Initialize user's personal folder
  initializeUserStorage: () => Promise<void>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: "root", name: "My Files", type: "root" }]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  // Transform database row to Folder
  const transformFolder = useCallback((row: Record<string, unknown>): Folder => {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: row.description as string | undefined,
      parentId: row.parent_id as string | undefined,
      ownerId: row.owner_id as string | undefined,
      folderType: row.folder_type as FolderType,
      clientId: row.client_id as string | undefined,
      isRoot: row.is_root as boolean,
      color: row.color as string | undefined,
      icon: row.icon as string | undefined,
      sortOrder: row.sort_order as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      createdBy: row.created_by as string | undefined,
    };
  }, []);

  // Transform database row to FileRecord
  const transformFile = useCallback((row: Record<string, unknown>): FileRecord => {
    return {
      id: row.id as string,
      name: row.name as string,
      originalName: row.original_name as string,
      description: row.description as string | undefined,
      folderId: row.folder_id as string | undefined,
      ownerId: row.owner_id as string | undefined,
      storagePath: row.storage_path as string,
      storageBucket: row.storage_bucket as string,
      mimeType: row.mime_type as string,
      sizeBytes: row.size_bytes as number,
      fileExtension: row.file_extension as string | undefined,
      checksum: row.checksum as string | undefined,
      isStarred: row.is_starred as boolean,
      isTrashed: row.is_trashed as boolean,
      trashedAt: row.trashed_at ? new Date(row.trashed_at as string) : undefined,
      clientId: row.client_id as string | undefined,
      version: row.version as number,
      currentVersionId: row.current_version_id as string | undefined,
      thumbnailPath: row.thumbnail_path as string | undefined,
      previewGenerated: row.preview_generated as boolean,
      metadata: (row.metadata as Record<string, unknown>) || {},
      tags: (row.tags as string[]) || [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      createdBy: row.created_by as string | undefined,
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at as string) : undefined,
    };
  }, []);

  // Log file activity
  const logActivity = useCallback(async (
    action: string,
    details: Record<string, unknown>,
    fileId?: string,
    folderId?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("file_activity").insert({
        file_id: fileId,
        folder_id: folderId,
        user_id: user.id,
        action,
        details,
      });
    } catch (err) {
      // Don't fail the operation if activity logging fails
      console.error("Error logging file activity:", err);
    }
  }, [supabase]);

  // Initialize user storage (create personal root folder if not exists)
  const initializeUserStorage = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if personal root folder exists
      const { data: existing } = await supabase
        .from("folders")
        .select("*")
        .eq("owner_id", user.id)
        .eq("is_root", true)
        .eq("folder_type", "personal")
        .single();

      if (!existing) {
        // Create personal root folder
        const { error: createError } = await supabase.from("folders").insert({
          name: "My Files",
          slug: "my-files",
          owner_id: user.id,
          folder_type: "personal",
          is_root: true,
          created_by: user.id,
        });

        if (createError) {
          console.error("Error creating personal folder:", createError);
        }
      }

      // Initialize storage quota if not exists
      try {
        const { data: quotaData, error: quotaError } = await supabase
          .from("storage_quotas")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (quotaError && quotaError.code !== "PGRST116") {
          // PGRST116 is "no rows returned" which is expected for new users
          // Other errors might indicate the table doesn't exist yet
          console.warn("Could not fetch storage quota, using default:", quotaError.message);
        }

        if (!quotaData) {
          // Try to insert a new quota record
          const { error: insertError } = await supabase.from("storage_quotas").insert({
            user_id: user.id,
            quota_bytes: DEFAULT_STORAGE_QUOTA_BYTES, // 25GB default
            used_bytes: 0,
            file_count: 0,
          });

          if (insertError) {
            console.warn("Could not create storage quota record:", insertError.message);
          }
        }

        // Fetch quota again
        const { data: newQuota } = await supabase
          .from("storage_quotas")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (newQuota && newQuota.quota_bytes && newQuota.used_bytes !== undefined) {
          const quotaBytes = newQuota.quota_bytes || DEFAULT_STORAGE_QUOTA_BYTES;
          const usedBytes = newQuota.used_bytes || 0;
          setQuota({
            id: newQuota.id || user.id,
            userId: user.id,
            quotaBytes: quotaBytes,
            usedBytes: usedBytes,
            fileCount: newQuota.file_count || 0,
            lastCalculatedAt: newQuota.last_calculated_at ? new Date(newQuota.last_calculated_at) : new Date(),
            createdAt: newQuota.created_at ? new Date(newQuota.created_at) : new Date(),
            updatedAt: newQuota.updated_at ? new Date(newQuota.updated_at) : new Date(),
            percentUsed: (usedBytes / quotaBytes) * 100,
            remainingBytes: quotaBytes - usedBytes,
          });
        } else {
          // Set default quota if no data available (table might not exist yet)
          setQuota({
            id: user.id,
            userId: user.id,
            quotaBytes: DEFAULT_STORAGE_QUOTA_BYTES, // 25GB
            usedBytes: 0,
            fileCount: 0,
            lastCalculatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            percentUsed: 0,
            remainingBytes: DEFAULT_STORAGE_QUOTA_BYTES,
          });
        }
      } catch (quotaErr) {
        console.warn("Storage quota initialization failed, using default:", quotaErr);
        // Set default quota on any error
        setQuota({
          id: user.id,
          userId: user.id,
          quotaBytes: DEFAULT_STORAGE_QUOTA_BYTES, // 25GB
          usedBytes: 0,
          fileCount: 0,
          lastCalculatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          percentUsed: 0,
          remainingBytes: DEFAULT_STORAGE_QUOTA_BYTES,
        });
      }
    } catch (err) {
      console.error("Error initializing user storage:", err);
    }
  }, [supabase]);

  // Navigate to folder
  const navigateToFolder = useCallback(async (folderId: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (folderId === null || folderId === "root") {
        // Go to root - show all root folders (personal, team, repository)
        const { data: rootFolders, error: foldersError } = await supabase
          .from("folders")
          .select("*")
          .is("parent_id", null)
          .order("folder_type", { ascending: true })
          .order("name", { ascending: true });

        // Handle table not existing or RLS errors gracefully
        if (foldersError) {
          console.warn("Folders query error:", foldersError);
          // If error code indicates table doesn't exist or permission issue, show empty state
          if (foldersError.code === "42P01" || foldersError.code === "PGRST116") {
            setFolders([]);
            setFiles([]);
            setCurrentFolder(null);
            setBreadcrumbs([{ id: "root", name: "All Files", type: "root" }]);
            return;
          }
          throw foldersError;
        }

        setFolders((rootFolders || []).map(transformFolder));
        setFiles([]);
        setCurrentFolder(null);
        setBreadcrumbs([{ id: "root", name: "All Files", type: "root" }]);
      } else {
        // Navigate to specific folder
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("*")
          .eq("id", folderId)
          .single();

        if (folderError) throw folderError;

        const transformedFolder = transformFolder(folder);
        setCurrentFolder(transformedFolder);

        // Fetch subfolders
        const { data: subfolders, error: subfoldersError } = await supabase
          .from("folders")
          .select("*")
          .eq("parent_id", folderId)
          .order("name", { ascending: true });

        if (subfoldersError) throw subfoldersError;

        setFolders((subfolders || []).map(transformFolder));

        // Fetch files in this folder
        const { data: folderFiles, error: filesError } = await supabase
          .from("files")
          .select("*")
          .eq("folder_id", folderId)
          .eq("is_trashed", false)
          .order("name", { ascending: true });

        if (filesError) throw filesError;

        setFiles((folderFiles || []).map(transformFile));

        // Build breadcrumbs
        const newBreadcrumbs: BreadcrumbItem[] = [{ id: "root", name: "All Files", type: "root" }];
        let currentId: string | undefined = folderId;
        const visited = new Set<string>();

        while (currentId && !visited.has(currentId)) {
          visited.add(currentId);
          const { data: parentFolderData } = await supabase
            .from("folders")
            .select("id, name, parent_id")
            .eq("id", currentId)
            .single();

          const parentFolder = parentFolderData as { id: string; name: string; parent_id: string | null } | null;

          if (parentFolder) {
            newBreadcrumbs.splice(1, 0, { id: parentFolder.id, name: parentFolder.name, type: "folder" });
            currentId = parentFolder.parent_id ?? undefined;
          } else {
            break;
          }
        }

        setBreadcrumbs(newBreadcrumbs);
      }
    } catch (err: unknown) {
      // Better error logging for Supabase errors
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : typeof err === 'object' && err !== null && 'code' in err
            ? `Database error: ${String((err as { code: unknown }).code)}`
            : "Failed to navigate";
      console.error("Error navigating to folder:", errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, transformFolder, transformFile]);

  // Navigate up one level
  const navigateUp = useCallback(async () => {
    if (currentFolder?.parentId) {
      await navigateToFolder(currentFolder.parentId);
    } else {
      await navigateToFolder(null);
    }
  }, [currentFolder, navigateToFolder]);

  // Refresh current folder
  const refreshCurrentFolder = useCallback(async () => {
    await navigateToFolder(currentFolder?.id || null);
  }, [currentFolder, navigateToFolder]);

  // Create folder
  const createFolder = useCallback(async (
    name: string,
    parentId?: string,
    type: FolderType = "personal"
  ): Promise<Folder | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("folders")
        .insert({
          name,
          slug: generateSlug(name),
          parent_id: parentId || currentFolder?.id || null,
          owner_id: user.id,
          folder_type: type,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newFolder = transformFolder(data);
      setFolders(prev => [...prev, newFolder]);
      return newFolder;
    } catch (err) {
      console.error("Error creating folder:", err);
      setError(err instanceof Error ? err.message : "Failed to create folder");
      return null;
    }
  }, [supabase, currentFolder, transformFolder]);

  // Rename folder
  const renameFolder = useCallback(async (folderId: string, newName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("folders")
        .update({ name: newName, slug: generateSlug(newName), updated_at: new Date().toISOString() })
        .eq("id", folderId);

      if (error) throw error;

      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName, slug: generateSlug(newName) } : f));
      return true;
    } catch (err) {
      console.error("Error renaming folder:", err);
      return false;
    }
  }, [supabase]);

  // Move folder
  const moveFolder = useCallback(async (folderId: string, newParentId: string | null): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("folders")
        .update({ parent_id: newParentId, updated_at: new Date().toISOString() })
        .eq("id", folderId);

      if (error) throw error;

      setFolders(prev => prev.filter(f => f.id !== folderId));
      return true;
    } catch (err) {
      console.error("Error moving folder:", err);
      return false;
    }
  }, [supabase]);

  // Recursively get all files in a folder tree
  const getAllFilesInFolder = useCallback(async (folderId: string): Promise<Array<{id: string; storage_path: string; storage_bucket: string; size_bytes: number}>> => {
    const allFiles: Array<{id: string; storage_path: string; storage_bucket: string; size_bytes: number}> = [];

    // Get direct files in this folder
    const { data: directFiles } = await supabase
      .from("files")
      .select("id, storage_path, storage_bucket, size_bytes")
      .eq("folder_id", folderId);

    if (directFiles) {
      allFiles.push(...directFiles);
    }

    // Get subfolders
    const { data: subfolders } = await supabase
      .from("folders")
      .select("id")
      .eq("parent_id", folderId);

    // Recursively get files from subfolders
    if (subfolders) {
      for (const subfolder of subfolders) {
        const subfolderFiles = await getAllFilesInFolder(subfolder.id);
        allFiles.push(...subfolderFiles);
      }
    }

    return allFiles;
  }, [supabase]);

  // Delete folder (with recursive storage cleanup)
  const deleteFolder = useCallback(async (folderId: string, forceDelete = false): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check for subfolders
      const { data: subfolders, error: subfoldersError } = await supabase
        .from("folders")
        .select("id")
        .eq("parent_id", folderId)
        .limit(1);

      if (subfoldersError) throw subfoldersError;

      // Check for files
      const { data: folderFiles, error: filesError } = await supabase
        .from("files")
        .select("id")
        .eq("folder_id", folderId)
        .eq("is_trashed", false)
        .limit(1);

      if (filesError) throw filesError;

      const hasContents = (subfolders && subfolders.length > 0) || (folderFiles && folderFiles.length > 0);

      if (hasContents && !forceDelete) {
        setError("Warning: Folder contains items that will also be deleted");
      }

      // Get all files recursively for storage cleanup
      const allFiles = await getAllFilesInFolder(folderId);

      // Delete files from storage first
      if (allFiles.length > 0) {
        const storagePaths = allFiles.map(f => f.storage_path);
        const { error: storageError } = await supabase.storage
          .from("files")
          .remove(storagePaths);

        if (storageError) {
          console.error("Error deleting files from storage:", storageError);
          // Continue anyway to clean up database
        }

        // Calculate total bytes freed
        const totalBytesFreed = allFiles.reduce((sum, f) => sum + (f.size_bytes || 0), 0);

        // Update quota
        if (totalBytesFreed > 0) {
          try {
            await supabase.rpc("increment_storage_usage", {
              p_user_id: user.id,
              p_bytes: -totalBytesFreed, // Negative to decrease
            });
          } catch {
            // Fallback to manual update
            await supabase.from("storage_quotas")
              .update({
                used_bytes: Math.max(0, (quota?.usedBytes || 0) - totalBytesFreed),
                file_count: Math.max(0, (quota?.fileCount || 0) - allFiles.length),
              })
              .eq("user_id", user.id);
          }

          // Update local quota state
          setQuota(prev => prev ? {
            ...prev,
            usedBytes: Math.max(0, prev.usedBytes - totalBytesFreed),
            fileCount: Math.max(0, prev.fileCount - allFiles.length),
            remainingBytes: prev.remainingBytes + totalBytesFreed,
            percentUsed: Math.max(0, ((prev.usedBytes - totalBytesFreed) / prev.quotaBytes) * 100),
          } : null);
        }
      }

      // Delete folder from database (CASCADE will delete files and subfolders in DB)
      const { error } = await supabase
        .from("folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;

      // Log activity
      await logActivity("delete_folder", {
        folder_id: folderId,
        files_deleted: allFiles.length,
        recursive: hasContents,
      }, undefined, folderId);

      setFolders(prev => prev.filter(f => f.id !== folderId));
      // Also remove any files that were in this folder from local state
      setFiles(prev => prev.filter(f => f.folderId !== folderId));
      return true;
    } catch (err) {
      console.error("Error deleting folder:", err);
      return false;
    }
  }, [supabase, quota, getAllFilesInFolder, logActivity]);

  // Generate unique filename if duplicate exists
  const generateUniqueName = useCallback(async (
    name: string,
    folderId: string | null | undefined,
    ownerId: string
  ): Promise<string> => {
    // Check if file with exact same name exists in folder (case-insensitive)
    const { data: existing } = await supabase
      .from("files")
      .select("name")
      .eq("folder_id", folderId)
      .eq("owner_id", ownerId)
      .eq("is_trashed", false);

    if (!existing || existing.length === 0) {
      return name; // No files in folder at all
    }

    // Check for exact match (case-insensitive)
    const exactMatch = existing.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (!exactMatch) {
      return name; // No duplicate, use original name
    }

    // Find a unique name by appending a number
    const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension
    const extension = name.includes(".") ? name.substring(name.lastIndexOf(".")) : "";

    // Get all files with similar names to find the highest counter
    const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+)\\)${extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const counters = existing
      .map(f => {
        const match = f.name.match(pattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);

    const counter = counters.length > 0 ? Math.max(...counters) + 1 : 1;
    const newName = `${baseName} (${counter})${extension}`;

    return newName;
  }, [supabase]);

  // Upload files
  const uploadFiles = useCallback(async (
    filesToUpload: File[],
    folderId?: string,
    clientId?: string
  ): Promise<FileRecord[]> => {
    const uploadedFiles: FileRecord[] = [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const targetFolderId = folderId || currentFolder?.id;

    for (const file of filesToUpload) {
      const uploadId = crypto.randomUUID();
      const storagePath = `${user.id}/${targetFolderId || "root"}/${uploadId}-${file.name}`;

      // Add to upload progress
      setUploads(prev => [...prev, {
        fileId: uploadId,
        fileName: file.name,
        progress: 0,
        status: "uploading",
        bytesUploaded: 0,
        totalBytes: file.size,
      }]);

      try {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("files")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Update progress
        setUploads(prev => prev.map(u => u.fileId === uploadId ? {
          ...u,
          progress: 100,
          status: "processing",
          bytesUploaded: file.size,
        } : u));

        // Get file extension
        const extension = file.name.split(".").pop()?.toLowerCase();

        // Generate unique name if duplicate exists
        const uniqueName = await generateUniqueName(file.name, targetFolderId, user.id);

        // Create file record in database
        const { data: fileRecord, error: dbError } = await supabase
          .from("files")
          .insert({
            name: uniqueName,
            original_name: file.name,
            folder_id: targetFolderId,
            owner_id: user.id,
            storage_path: storagePath,
            storage_bucket: "files",
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            file_extension: extension,
            client_id: clientId,
            created_by: user.id,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Create initial version
        await supabase.from("file_versions").insert({
          file_id: fileRecord.id,
          version_number: 1,
          storage_path: storagePath,
          storage_bucket: "files",
          size_bytes: file.size,
          created_by: user.id,
        });

        // Update quota - try RPC first, fallback to direct update
        try {
          await supabase.rpc("increment_storage_usage", {
            p_user_id: user.id,
            p_bytes: file.size,
          });
        } catch {
          // RPC might not exist, update manually
          await supabase.from("storage_quotas")
            .update({
              used_bytes: (quota?.usedBytes || 0) + file.size,
              file_count: (quota?.fileCount || 0) + 1,
            })
            .eq("user_id", user.id);
        }

        const transformedFile = transformFile(fileRecord);
        uploadedFiles.push(transformedFile);

        // Update progress to complete
        setUploads(prev => prev.map(u => u.fileId === uploadId ? {
          ...u,
          status: "complete",
        } : u));

        // Add to files list
        setFiles(prev => [...prev, transformedFile]);

      } catch (err) {
        console.error("Error uploading file:", file.name, err);
        setUploads(prev => prev.map(u => u.fileId === uploadId ? {
          ...u,
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        } : u));
      }
    }

    // Clean up completed uploads after 3 seconds
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.status !== "complete"));
    }, 3000);

    return uploadedFiles;
  }, [supabase, currentFolder, quota, transformFile]);

  // Download file or get preview URL
  const downloadFile = useCallback(async (fileId: string, getUrlOnly: boolean = false): Promise<string | void> => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) throw new Error("File not found");

      if (getUrlOnly) {
        // Return a signed URL for preview
        const { data, error } = await supabase.storage
          .from(file.storageBucket)
          .createSignedUrl(file.storagePath, 3600); // 1 hour expiry

        if (error) throw error;
        return data.signedUrl;
      }

      const { data, error } = await supabase.storage
        .from(file.storageBucket)
        .download(file.storagePath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update last accessed
      await supabase
        .from("files")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", fileId);

    } catch (err) {
      console.error("Error downloading file:", err);
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }, [supabase, files]);

  // Rename file
  const renameFile = useCallback(async (fileId: string, newName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("files")
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq("id", fileId);

      if (error) throw error;

      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: newName } : f));
      return true;
    } catch (err) {
      console.error("Error renaming file:", err);
      return false;
    }
  }, [supabase]);

  // Move file
  const moveFile = useCallback(async (fileId: string, newFolderId: string | null): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("files")
        .update({ folder_id: newFolderId, updated_at: new Date().toISOString() })
        .eq("id", fileId);

      if (error) throw error;

      setFiles(prev => prev.filter(f => f.id !== fileId));
      return true;
    } catch (err) {
      console.error("Error moving file:", err);
      return false;
    }
  }, [supabase]);

  // Copy file
  const copyFile = useCallback(async (fileId: string, newFolderId: string | null): Promise<FileRecord | null> => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) throw new Error("File not found");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Copy in storage
      const newPath = `${user.id}/${newFolderId || "root"}/${crypto.randomUUID()}-${file.originalName}`;
      const { error: copyError } = await supabase.storage
        .from(file.storageBucket)
        .copy(file.storagePath, newPath);

      if (copyError) throw copyError;

      // Generate unique name for the copy
      const copyName = await generateUniqueName(`Copy of ${file.name}`, newFolderId, user.id);

      // Create new file record
      const { data: newFile, error: dbError } = await supabase
        .from("files")
        .insert({
          name: copyName,
          original_name: file.originalName,
          folder_id: newFolderId,
          owner_id: user.id,
          storage_path: newPath,
          storage_bucket: file.storageBucket,
          mime_type: file.mimeType,
          size_bytes: file.sizeBytes,
          file_extension: file.fileExtension,
          client_id: file.clientId,
          created_by: user.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update storage quota for the copied file
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        try {
          await supabase.rpc("increment_storage_usage", {
            p_user_id: currentUser.id,
            p_bytes: file.sizeBytes,
          });
        } catch {
          // Fallback: manually update if RPC doesn't exist
          await supabase.from("storage_quotas")
            .update({
              used_bytes: (quota?.usedBytes || 0) + file.sizeBytes,
              file_count: (quota?.fileCount || 0) + 1,
            })
            .eq("user_id", currentUser.id);
        }

        // Update local quota state
        setQuota(prev => prev ? {
          ...prev,
          usedBytes: prev.usedBytes + file.sizeBytes,
          fileCount: prev.fileCount + 1,
          remainingBytes: prev.remainingBytes - file.sizeBytes,
          percentUsed: ((prev.usedBytes + file.sizeBytes) / prev.quotaBytes) * 100,
        } : null);
      }

      return transformFile(newFile);
    } catch (err) {
      console.error("Error copying file:", err);
      return null;
    }
  }, [supabase, files, transformFile]);

  // Delete file (move to trash or permanent)
  const deleteFile = useCallback(async (fileId: string, permanent = false): Promise<boolean> => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) throw new Error("File not found");

      if (permanent) {
        // Delete from storage
        await supabase.storage
          .from(file.storageBucket)
          .remove([file.storagePath]);

        // Delete from database
        const { error } = await supabase
          .from("files")
          .delete()
          .eq("id", fileId);

        if (error) throw error;
      } else {
        // Move to trash
        const { error } = await supabase
          .from("files")
          .update({
            is_trashed: true,
            trashed_at: new Date().toISOString(),
          })
          .eq("id", fileId);

        if (error) throw error;
      }

      setFiles(prev => prev.filter(f => f.id !== fileId));
      return true;
    } catch (err) {
      console.error("Error deleting file:", err);
      return false;
    }
  }, [supabase, files]);

  // Restore file from trash
  const restoreFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("files")
        .update({
          is_trashed: false,
          trashed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fileId)
        .select()
        .single();

      if (error) throw error;

      // Remove from local trash view (files state)
      setFiles(prev => prev.filter(f => f.id !== fileId));

      // Log activity
      await logActivity("restore_file", { file_id: fileId }, fileId);

      return true;
    } catch (err) {
      console.error("Error restoring file:", err);
      return false;
    }
  }, [supabase, logActivity]);

  // Star/unstar file
  const starFile = useCallback(async (fileId: string, starred: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("files")
        .update({ is_starred: starred })
        .eq("id", fileId);

      if (error) throw error;

      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, isStarred: starred } : f));
      return true;
    } catch (err) {
      console.error("Error starring file:", err);
      return false;
    }
  }, [supabase]);

  // Get file versions
  const getFileVersions = useCallback(async (fileId: string): Promise<FileVersion[]> => {
    try {
      const { data, error } = await supabase
        .from("file_versions")
        .select("*")
        .eq("file_id", fileId)
        .order("version_number", { ascending: false });

      if (error) throw error;

      return (data || []).map(v => ({
        id: v.id,
        fileId: v.file_id,
        versionNumber: v.version_number,
        storagePath: v.storage_path,
        storageBucket: v.storage_bucket,
        sizeBytes: v.size_bytes,
        checksum: v.checksum,
        changeSummary: v.change_summary,
        createdAt: new Date(v.created_at),
        createdBy: v.created_by,
      }));
    } catch (err) {
      console.error("Error getting file versions:", err);
      return [];
    }
  }, [supabase]);

  // Restore version (creates a new version entry and copies the file in storage)
  const restoreVersion = useCallback(async (fileId: string, versionId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the version to restore
      const { data: version, error: versionError } = await supabase
        .from("file_versions")
        .select("*")
        .eq("id", versionId)
        .single();

      if (versionError) throw versionError;

      // Get current file info
      const { data: currentFile, error: fileError } = await supabase
        .from("files")
        .select("version, storage_path, storage_bucket, folder_id, name")
        .eq("id", fileId)
        .single();

      if (fileError) throw fileError;

      const newVersionNumber = (currentFile.version || 1) + 1;

      // Create a new storage path for the restored version (copy the file)
      const newStoragePath = `${user.id}/${currentFile.folder_id || "root"}/${crypto.randomUUID()}-${currentFile.name}`;

      // Copy the old version's file to new location in storage
      const { error: copyError } = await supabase.storage
        .from(version.storage_bucket)
        .copy(version.storage_path, newStoragePath);

      if (copyError) throw copyError;

      // Create a new version entry for the restoration (audit trail)
      const { data: newVersion, error: newVersionError } = await supabase
        .from("file_versions")
        .insert({
          file_id: fileId,
          version_number: newVersionNumber,
          storage_path: newStoragePath,
          storage_bucket: version.storage_bucket,
          size_bytes: version.size_bytes,
          checksum: version.checksum,
          change_summary: `Restored from version ${version.version_number}`,
          created_by: user.id,
        })
        .select()
        .single();

      if (newVersionError) throw newVersionError;

      // Update the file to point to the restored version
      const { error: updateError } = await supabase
        .from("files")
        .update({
          storage_path: newStoragePath,
          size_bytes: version.size_bytes,
          version: newVersionNumber,
          current_version_id: newVersion.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fileId);

      if (updateError) throw updateError;

      // Update local state
      setFiles(prev => prev.map(f => f.id === fileId ? {
        ...f,
        storagePath: newStoragePath,
        sizeBytes: version.size_bytes,
        version: newVersionNumber,
        updatedAt: new Date(),
      } : f));

      // Log activity
      await logActivity("restore_version", {
        restored_from_version: version.version_number,
        new_version: newVersionNumber,
      }, fileId);

      return true;
    } catch (err) {
      console.error("Error restoring version:", err);
      return false;
    }
  }, [supabase, logActivity]);

  // Create share link
  const createShareLink = useCallback(async (
    fileId: string,
    options?: Partial<FileShare>
  ): Promise<FileShare | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const shareToken = crypto.randomUUID();

      const { data, error } = await supabase
        .from("file_shares")
        .insert({
          file_id: fileId,
          share_token: shareToken,
          share_type: options?.shareType || "link",
          permission: options?.permission || "view",
          expires_at: options?.expiresAt?.toISOString(),
          max_downloads: options?.maxDownloads,
          created_by: user.id,
          recipient_email: options?.recipientEmail,
          message: options?.message,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...data,
        shareUrl: `${window.location.origin}/share/${shareToken}`,
      } as FileShare;
    } catch (err) {
      console.error("Error creating share link:", err);
      return null;
    }
  }, [supabase]);

  // Get share links for a file
  const getShareLinks = useCallback(async (fileId: string): Promise<FileShare[]> => {
    try {
      const { data, error } = await supabase
        .from("file_shares")
        .select("*")
        .eq("file_id", fileId)
        .eq("is_active", true);

      if (error) throw error;

      return (data || []).map(s => ({
        ...s,
        shareUrl: `${window.location.origin}/share/${s.share_token}`,
      })) as FileShare[];
    } catch (err) {
      console.error("Error getting share links:", err);
      return [];
    }
  }, [supabase]);

  // Revoke share link
  const revokeShareLink = useCallback(async (shareId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("file_shares")
        .update({ is_active: false })
        .eq("id", shareId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error revoking share link:", err);
      return false;
    }
  }, [supabase]);

  // Get folder permissions
  const getFolderPermissions = useCallback(async (folderId: string): Promise<FolderPermission[]> => {
    try {
      const { data, error } = await supabase
        .from("folder_permissions")
        .select(`
          *,
          users:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("folder_id", folderId);

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        folderId: p.folder_id,
        userId: p.user_id,
        role: p.role,
        permission: p.permission as Permission,
        inherited: p.inherited,
        grantedBy: p.granted_by,
        createdAt: new Date(p.created_at),
        expiresAt: p.expires_at ? new Date(p.expires_at) : undefined,
        userName: p.users?.full_name,
        userEmail: p.users?.email,
        userAvatar: p.users?.avatar_url,
      }));
    } catch (err) {
      console.error("Error getting folder permissions:", err);
      return [];
    }
  }, [supabase]);

  // Set folder permission
  const setFolderPermission = useCallback(async (
    folderId: string,
    userId: string,
    permission: Permission
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("folder_permissions")
        .upsert({
          folder_id: folderId,
          user_id: userId,
          permission,
          granted_by: user.id,
        }, {
          onConflict: "folder_id,user_id",
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error setting folder permission:", err);
      return false;
    }
  }, [supabase]);

  // Remove folder permission
  const removeFolderPermission = useCallback(async (folderId: string, userId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("folder_permissions")
        .delete()
        .eq("folder_id", folderId)
        .eq("user_id", userId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error removing folder permission:", err);
      return false;
    }
  }, [supabase]);

  // Selection handlers
  const selectItem = useCallback((itemId: string) => {
    setSelectedItems(prev => [...prev, itemId]);
  }, []);

  const deselectItem = useCallback((itemId: string) => {
    setSelectedItems(prev => prev.filter(id => id !== itemId));
  }, []);

  const selectAll = useCallback(() => {
    const allIds = [...folders.map(f => f.id), ...files.map(f => f.id)];
    setSelectedItems(allIds);
  }, [folders, files]);

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  }, []);

  // Bulk operations
  const bulkMove = useCallback(async (targetFolderId: string | null): Promise<boolean> => {
    try {
      for (const itemId of selectedItems) {
        const isFolder = folders.some(f => f.id === itemId);
        if (isFolder) {
          await moveFolder(itemId, targetFolderId);
        } else {
          await moveFile(itemId, targetFolderId);
        }
      }
      clearSelection();
      return true;
    } catch (err) {
      console.error("Error in bulk move:", err);
      return false;
    }
  }, [selectedItems, folders, moveFolder, moveFile, clearSelection]);

  const bulkDelete = useCallback(async (permanent = false): Promise<boolean> => {
    try {
      for (const itemId of selectedItems) {
        const isFolder = folders.some(f => f.id === itemId);
        if (isFolder) {
          await deleteFolder(itemId);
        } else {
          await deleteFile(itemId, permanent);
        }
      }
      clearSelection();
      return true;
    } catch (err) {
      console.error("Error in bulk delete:", err);
      return false;
    }
  }, [selectedItems, folders, deleteFolder, deleteFile, clearSelection]);

  const bulkDownload = useCallback(async () => {
    const fileIds = selectedItems.filter(itemId => files.some(f => f.id === itemId));

    if (fileIds.length === 0) {
      setError("No files selected for download");
      return;
    }

    if (fileIds.length === 1) {
      // Single file - download directly
      try {
        await downloadFile(fileIds[0]);
      } catch (err) {
        console.error("Error downloading file:", err);
        setError(err instanceof Error ? err.message : "Failed to download file");
      }
      return;
    }

    // Multiple files - stagger downloads with delay to avoid browser blocking
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileIds.length; i++) {
      try {
        // Add delay between downloads to prevent browser blocking
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        await downloadFile(fileIds[i]);
        successCount++;
      } catch (err) {
        console.error(`Error downloading file ${fileIds[i]}:`, err);
        failCount++;
      }
    }

    // Show summary
    if (failCount > 0) {
      setError(`Downloaded ${successCount} of ${fileIds.length} files. ${failCount} failed.`);
    }
  }, [selectedItems, files, downloadFile]);

  // Search files
  const searchFiles = useCallback(async (query: string, filter?: FileFilter, searchInCurrentFolderOnly = false): Promise<FileRecord[]> => {
    try {
      let queryBuilder = supabase
        .from("files")
        .select("*")
        .eq("is_trashed", false)
        .ilike("name", `%${query}%`);

      // Optionally search only in current folder
      if (searchInCurrentFolderOnly && currentFolder) {
        queryBuilder = queryBuilder.eq("folder_id", currentFolder.id);
      }

      if (filter?.mimeTypes?.length) {
        queryBuilder = queryBuilder.in("mime_type", filter.mimeTypes);
      }

      if (filter?.isStarred !== undefined) {
        queryBuilder = queryBuilder.eq("is_starred", filter.isStarred);
      }

      if (filter?.clientId) {
        queryBuilder = queryBuilder.eq("client_id", filter.clientId);
      }

      if (filter?.ownerId) {
        queryBuilder = queryBuilder.eq("owner_id", filter.ownerId);
      }

      const { data, error } = await queryBuilder
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map(transformFile);
    } catch (err) {
      console.error("Error searching files:", err);
      return [];
    }
  }, [supabase, transformFile, currentFolder]);

  // Get recent files
  const getRecentFiles = useCallback(async (limit = 10): Promise<FileRecord[]> => {
    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("is_trashed", false)
        .order("last_accessed_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(transformFile);
    } catch (err) {
      console.error("Error getting recent files:", err);
      return [];
    }
  }, [supabase, transformFile]);

  // Get starred files
  const getStarredFiles = useCallback(async (): Promise<FileRecord[]> => {
    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("is_starred", true)
        .eq("is_trashed", false)
        .order("name", { ascending: true });

      if (error) throw error;

      return (data || []).map(transformFile);
    } catch (err) {
      console.error("Error getting starred files:", err);
      return [];
    }
  }, [supabase, transformFile]);

  // Get trashed files
  const getTrashedFiles = useCallback(async (): Promise<FileRecord[]> => {
    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("is_trashed", true)
        .order("trashed_at", { ascending: false });

      if (error) throw error;

      return (data || []).map(transformFile);
    } catch (err) {
      console.error("Error getting trashed files:", err);
      return [];
    }
  }, [supabase, transformFile]);

  // Empty trash - permanently delete all trashed files
  const emptyTrash = useCallback(async (): Promise<{ success: boolean; deletedCount: number }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get all trashed files for this user
      const { data: trashedFiles, error: fetchError } = await supabase
        .from("files")
        .select("id, storage_path, storage_bucket, size_bytes, name")
        .eq("is_trashed", true)
        .eq("owner_id", user.id);

      if (fetchError) throw fetchError;

      if (!trashedFiles || trashedFiles.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      // Calculate total bytes to free
      const totalBytesFreed = trashedFiles.reduce((sum, f) => sum + (f.size_bytes || 0), 0);

      // Delete files from storage
      const storagePaths = trashedFiles.map(f => f.storage_path);
      const { error: storageError } = await supabase.storage
        .from("files")
        .remove(storagePaths);

      if (storageError) {
        console.error("Error deleting files from storage:", storageError);
        // Continue anyway to clean up database records
      }

      // Delete file records from database (triggers will update quota)
      const fileIds = trashedFiles.map(f => f.id);
      const { error: deleteError } = await supabase
        .from("files")
        .delete()
        .in("id", fileIds);

      if (deleteError) throw deleteError;

      // Update quota using RPC
      try {
        await supabase.rpc("increment_storage_usage", {
          p_user_id: user.id,
          p_bytes: -totalBytesFreed, // Negative to decrease
        });
      } catch {
        // Fallback to manual update
        await supabase.from("storage_quotas")
          .update({
            used_bytes: Math.max(0, (quota?.usedBytes || 0) - totalBytesFreed),
            file_count: Math.max(0, (quota?.fileCount || 0) - trashedFiles.length),
          })
          .eq("user_id", user.id);
      }

      // Update local quota state
      setQuota(prev => prev ? {
        ...prev,
        usedBytes: Math.max(0, prev.usedBytes - totalBytesFreed),
        fileCount: Math.max(0, prev.fileCount - trashedFiles.length),
        remainingBytes: prev.remainingBytes + totalBytesFreed,
        percentUsed: Math.max(0, ((prev.usedBytes - totalBytesFreed) / prev.quotaBytes) * 100),
      } : null);

      // Log activity
      await logActivity("empty_trash", {
        deleted_count: trashedFiles.length,
        deleted_files: trashedFiles.map(f => f.name),
        total_bytes_freed: totalBytesFreed,
      });

      return { success: true, deletedCount: trashedFiles.length };
    } catch (err) {
      console.error("Error emptying trash:", err);
      return { success: false, deletedCount: 0 };
    }
  }, [supabase, logActivity]);

  // Get file activity
  const getFileActivity = useCallback(async (fileId: string): Promise<FileActivity[]> => {
    try {
      const { data, error } = await supabase
        .from("file_activity")
        .select("*")
        .eq("file_id", fileId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map(a => ({
        id: a.id,
        fileId: a.file_id,
        folderId: a.folder_id,
        userId: a.user_id,
        action: a.action,
        details: a.details || {},
        ipAddress: a.ip_address,
        userAgent: a.user_agent,
        createdAt: new Date(a.created_at),
      }));
    } catch (err) {
      console.error("Error getting file activity:", err);
      return [];
    }
  }, [supabase]);

  // Initialize on mount (only once)
  useEffect(() => {
    initializeUserStorage();
    navigateToFolder(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - intentionally run only once on mount

  // Set up realtime subscription (with owner_id filter for better performance)
  useEffect(() => {
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channelRef.current = supabase
        .channel("files-realtime")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "files",
          filter: `owner_id=eq.${user.id}`,
        }, (payload) => {
          const newFile = transformFile(payload.new as Record<string, unknown>);
          if (newFile.folderId === currentFolder?.id) {
            setFiles(prev => [newFile, ...prev]);
          }
        })
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "files",
          filter: `owner_id=eq.${user.id}`,
        }, (payload) => {
          const updatedFile = transformFile(payload.new as Record<string, unknown>);
          setFiles(prev => prev.map(f => f.id === updatedFile.id ? updatedFile : f));
        })
        .on("postgres_changes", {
          event: "DELETE",
          schema: "public",
          table: "files",
        }, (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setFiles(prev => prev.filter(f => f.id !== deletedId));
        })
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "folders",
          filter: `owner_id=eq.${user.id}`,
        }, (payload) => {
          const newFolder = transformFolder(payload.new as Record<string, unknown>);
          if (newFolder.parentId === currentFolder?.id || (!newFolder.parentId && !currentFolder)) {
            setFolders(prev => [...prev, newFolder]);
          }
        })
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "folders",
          filter: `owner_id=eq.${user.id}`,
        }, (payload) => {
          const updatedFolder = transformFolder(payload.new as Record<string, unknown>);
          setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
        })
        .on("postgres_changes", {
          event: "DELETE",
          schema: "public",
          table: "folders",
        }, (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setFolders(prev => prev.filter(f => f.id !== deletedId));
        })
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [supabase, currentFolder, transformFile, transformFolder]);

  const contextValue = useMemo(() => ({
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
    copyFile,
    deleteFile,
    restoreFile,
    starFile,
    getFileVersions,
    restoreVersion,
    createShareLink,
    getShareLinks,
    revokeShareLink,
    getFolderPermissions,
    setFolderPermission,
    removeFolderPermission,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    toggleSelection,
    bulkMove,
    bulkDelete,
    bulkDownload,
    searchFiles,
    getRecentFiles,
    getStarredFiles,
    getTrashedFiles,
    emptyTrash,
    getFileActivity,
    initializeUserStorage,
  }), [
    folders, files, currentFolder, breadcrumbs, selectedItems, uploads, quota, isLoading, error,
    navigateToFolder, navigateUp, refreshCurrentFolder, createFolder, renameFolder, moveFolder,
    deleteFolder, uploadFiles, downloadFile, renameFile, moveFile, copyFile, deleteFile,
    restoreFile, starFile, getFileVersions, restoreVersion, createShareLink, getShareLinks,
    revokeShareLink, getFolderPermissions, setFolderPermission, removeFolderPermission,
    selectItem, deselectItem, selectAll, clearSelection, toggleSelection, bulkMove, bulkDelete,
    bulkDownload, searchFiles, getRecentFiles, getStarredFiles, getTrashedFiles, emptyTrash,
    getFileActivity, initializeUserStorage,
  ]);

  return (
    <FileContext.Provider value={contextValue}>
      {children}
    </FileContext.Provider>
  );
}

export function useFiles() {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error("useFiles must be used within a FileProvider");
  }
  return context;
}
