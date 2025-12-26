// File Storage System Types

export type FolderType = "personal" | "team" | "repository" | "client";
export type Permission = "view" | "edit" | "admin";
export type ShareType = "link" | "email" | "internal";
export type SharePermission = "view" | "download" | "edit";

export interface Folder {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  ownerId?: string;
  folderType: FolderType;
  clientId?: string;
  isRoot: boolean;
  color?: string;
  icon?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  // Computed/joined fields
  path?: string;
  fileCount?: number;
  totalSize?: number;
  children?: Folder[];
  permission?: Permission;
}

export interface FileRecord {
  id: string;
  name: string;
  originalName: string;
  description?: string;
  folderId?: string;
  ownerId?: string;
  storagePath: string;
  storageBucket: string;
  mimeType: string;
  sizeBytes: number;
  fileExtension?: string;
  checksum?: string;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt?: Date;
  clientId?: string;
  version: number;
  currentVersionId?: string;
  thumbnailPath?: string;
  previewGenerated: boolean;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  lastAccessedAt?: Date;
  // Computed/joined fields
  folderName?: string;
  folderPath?: string;
  ownerName?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  storagePath: string;
  storageBucket: string;
  sizeBytes: number;
  checksum?: string;
  changeSummary?: string;
  createdAt: Date;
  createdBy?: string;
  createdByName?: string;
}

export interface FolderPermission {
  id: string;
  folderId: string;
  userId?: string;
  role?: string;
  permission: Permission;
  inherited: boolean;
  grantedBy?: string;
  createdAt: Date;
  expiresAt?: Date;
  // Joined fields
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export interface FileShare {
  id: string;
  fileId?: string;
  folderId?: string;
  shareToken: string;
  shareType: ShareType;
  permission: SharePermission;
  passwordHash?: string;
  maxDownloads?: number;
  downloadCount: number;
  expiresAt?: Date;
  createdBy?: string;
  createdAt: Date;
  lastAccessedAt?: Date;
  recipientEmail?: string;
  message?: string;
  isActive: boolean;
  // Computed
  shareUrl?: string;
  fileName?: string;
  folderName?: string;
}

export interface StorageQuota {
  id: string;
  userId: string;
  quotaBytes: number;
  usedBytes: number;
  fileCount: number;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // Computed
  percentUsed: number;
  remainingBytes: number;
}

export interface FileActivity {
  id: string;
  fileId?: string;
  folderId?: string;
  userId?: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  // Joined fields
  userName?: string;
  fileName?: string;
  folderName?: string;
}

// UI State types
export interface FileTreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: FileTreeNode[];
  data: Folder | FileRecord;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  type: "folder" | "root";
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  error?: string;
  bytesUploaded: number;
  totalBytes: number;
}

export interface FileFilter {
  search?: string;
  mimeTypes?: string[];
  extensions?: string[];
  folderTypes?: FolderType[];
  isStarred?: boolean;
  isTrashed?: boolean;
  clientId?: string;
  ownerId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  sortBy?: "name" | "size" | "date" | "type";
  sortOrder?: "asc" | "desc";
}

// File type categories for preview
export const FILE_CATEGORIES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"],
  pdf: ["application/pdf"],
  document: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "text/plain",
    "text/markdown",
    "text/rtf",
  ],
  spreadsheet: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/csv",
  ],
  presentation: [
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.presentation",
  ],
  video: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
  code: [
    "text/javascript",
    "application/javascript",
    "text/typescript",
    "application/json",
    "text/html",
    "text/css",
    "text/x-python",
  ],
  archive: [
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/gzip",
    "application/x-tar",
  ],
} as const;

export type FileCategory = keyof typeof FILE_CATEGORIES;

export function getFileCategory(mimeType: string): FileCategory | "other" {
  for (const [category, types] of Object.entries(FILE_CATEGORIES)) {
    if ((types as readonly string[]).includes(mimeType)) {
      return category as FileCategory;
    }
  }
  return "other";
}

export function getFileIcon(mimeType: string): string {
  const category = getFileCategory(mimeType);
  const iconMap: Record<FileCategory | "other", string> = {
    image: "Image",
    pdf: "FileText",
    document: "FileText",
    spreadsheet: "Sheet",
    presentation: "Presentation",
    video: "Video",
    audio: "Music",
    code: "Code",
    archive: "Archive",
    other: "File",
  };
  return iconMap[category];
}

export function formatFileSize(bytes: number | undefined | null): string {
  // Handle undefined, null, NaN, or negative values
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Ensure i is within bounds
  const safeIndex = Math.min(Math.max(i, 0), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(2)) + " " + sizes[safeIndex];
}

// 25GB storage quota constant (in bytes)
export const DEFAULT_STORAGE_QUOTA_BYTES = 26843545600;

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
