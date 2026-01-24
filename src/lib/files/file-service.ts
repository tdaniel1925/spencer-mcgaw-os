/**
 * FileService - Business logic layer for file operations
 * Similar to GraphEmailService pattern
 *
 * This service provides a clean API for file operations by calling
 * the API routes instead of direct Supabase calls.
 */

import type { FileRecord, Folder } from "./types";

export interface UploadOptions {
  file: File;
  folderId?: string | null;
}

export interface ListFilesOptions {
  folderId?: string;
  search?: string;
  sort?: "name" | "size" | "created_at" | "modified_at";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  starred?: boolean;
  trashed?: boolean;
}

export interface UpdateFileOptions {
  name?: string;
  folderId?: string | null;
  isStarred?: boolean;
}

export interface CreateFolderOptions {
  name: string;
  parentId?: string | null;
  folderType?: "personal" | "team" | "shared" | "repository" | "client";
  color?: string | null;
  description?: string | null;
}

export interface UpdateFolderOptions {
  name?: string;
  parentId?: string | null;
  color?: string | null;
  description?: string | null;
}

export class FileService {
  /**
   * Upload a file
   */
  static async uploadFile(options: UploadOptions): Promise<FileRecord> {
    const formData = new FormData();
    formData.append("file", options.file);
    if (options.folderId) {
      formData.append("folderId", options.folderId);
    }

    const response = await fetch("/api/files", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload file");
    }

    const data = await response.json();
    return data.file;
  }

  /**
   * List files with filters
   */
  static async listFiles(options: ListFilesOptions = {}): Promise<{
    files: FileRecord[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const params = new URLSearchParams();

    if (options.folderId) params.append("folderId", options.folderId);
    if (options.search) params.append("search", options.search);
    if (options.sort) params.append("sort", options.sort);
    if (options.order) params.append("order", options.order);
    if (options.limit) params.append("limit", options.limit.toString());
    if (options.offset) params.append("offset", options.offset.toString());
    if (options.starred !== undefined) params.append("starred", options.starred.toString());
    if (options.trashed !== undefined) params.append("trashed", options.trashed.toString());

    const response = await fetch(`/api/files?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list files");
    }

    return response.json();
  }

  /**
   * Get file metadata
   */
  static async getFile(fileId: string): Promise<FileRecord> {
    const response = await fetch(`/api/files/${fileId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get file");
    }

    const data = await response.json();
    return data.file;
  }

  /**
   * Update file metadata (rename, move, star)
   */
  static async updateFile(fileId: string, options: UpdateFileOptions): Promise<FileRecord> {
    const response = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update file");
    }

    const data = await response.json();
    return data.file;
  }

  /**
   * Delete file (move to trash or permanent)
   */
  static async deleteFile(fileId: string, permanent: boolean = false): Promise<void> {
    const url = permanent ? `/api/files/${fileId}?permanent=true` : `/api/files/${fileId}`;

    const response = await fetch(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete file");
    }
  }

  /**
   * Restore file from trash
   */
  static async restoreFile(fileId: string): Promise<FileRecord> {
    const response = await fetch(`/api/files/${fileId}/restore`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to restore file");
    }

    const data = await response.json();
    return data.file;
  }

  /**
   * Download file (get signed URL)
   */
  static async downloadFile(fileId: string): Promise<{
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }> {
    const response = await fetch(`/api/files/${fileId}/download`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get download URL");
    }

    return response.json();
  }

  /**
   * Bulk download multiple files
   */
  static async bulkDownload(fileIds: string[]): Promise<void> {
    const downloads = await Promise.allSettled(
      fileIds.map(async (id) => {
        const { downloadUrl, fileName } = await FileService.downloadFile(id);

        // Trigger browser download
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        link.click();
      })
    );

    const failed = downloads.filter((d) => d.status === "rejected").length;
    if (failed > 0) {
      throw new Error(`Failed to download ${failed} file(s)`);
    }
  }

  /**
   * Create folder
   */
  static async createFolder(options: CreateFolderOptions): Promise<Folder> {
    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create folder");
    }

    const data = await response.json();
    return data.folder;
  }

  /**
   * List folders
   */
  static async listFolders(options: {
    parentId?: string | null;
    type?: "personal" | "team" | "shared" | "repository" | "client";
    includeSubfolders?: boolean;
  } = {}): Promise<Folder[]> {
    const params = new URLSearchParams();

    if (options.parentId) params.append("parentId", options.parentId);
    if (options.type) params.append("type", options.type);
    if (options.includeSubfolders !== undefined)
      params.append("includeSubfolders", options.includeSubfolders.toString());

    const response = await fetch(`/api/folders?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list folders");
    }

    const data = await response.json();
    return data.folders;
  }

  /**
   * Get folder details
   */
  static async getFolder(folderId: string): Promise<Folder> {
    const response = await fetch(`/api/folders/${folderId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get folder");
    }

    const data = await response.json();
    return data.folder;
  }

  /**
   * Update folder
   */
  static async updateFolder(folderId: string, options: UpdateFolderOptions): Promise<Folder> {
    const response = await fetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update folder");
    }

    const data = await response.json();
    return data.folder;
  }

  /**
   * Delete folder recursively
   */
  static async deleteFolder(folderId: string): Promise<{
    deletedFiles: number;
    deletedFolders: number;
    freedBytes: number;
  }> {
    const response = await fetch(`/api/folders/${folderId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete folder");
    }

    return response.json();
  }

  /**
   * Search files by name
   */
  static async searchFiles(query: string): Promise<FileRecord[]> {
    const { files } = await FileService.listFiles({ search: query, limit: 100 });
    return files;
  }

  /**
   * Get recent files
   */
  static async getRecentFiles(limit: number = 20): Promise<FileRecord[]> {
    const { files } = await FileService.listFiles({
      sort: "modified_at",
      order: "desc",
      limit,
    });
    return files;
  }

  /**
   * Get starred files
   */
  static async getStarredFiles(): Promise<FileRecord[]> {
    const { files } = await FileService.listFiles({ starred: true, limit: 1000 });
    return files;
  }

  /**
   * Get trashed files
   */
  static async getTrashedFiles(): Promise<FileRecord[]> {
    const { files } = await FileService.listFiles({ trashed: true, limit: 1000 });
    return files;
  }
}
