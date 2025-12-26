"use client";

import { cn } from "@/lib/utils";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Upload,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SyncStatus = "synced" | "syncing" | "pending" | "error" | "offline" | "uploading";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<SyncStatus, {
  icon: typeof Cloud;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  synced: {
    icon: CheckCircle,
    label: "Synced",
    description: "File is up to date",
    color: "text-green-600 dark:text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  syncing: {
    icon: RefreshCw,
    label: "Syncing",
    description: "Syncing with cloud...",
    color: "text-blue-600 dark:text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    animate: true,
  },
  pending: {
    icon: Cloud,
    label: "Pending",
    description: "Waiting to sync",
    color: "text-amber-600 dark:text-amber-500",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  uploading: {
    icon: Upload,
    label: "Uploading",
    description: "Uploading to cloud...",
    color: "text-blue-600 dark:text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    animate: true,
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    description: "Sync failed - click to retry",
    color: "text-red-600 dark:text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  offline: {
    icon: CloudOff,
    label: "Offline",
    description: "Available offline only",
    color: "text-gray-500 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
};

const sizeConfig = {
  sm: { icon: "h-3 w-3", padding: "p-0.5", text: "text-xs" },
  md: { icon: "h-4 w-4", padding: "p-1", text: "text-sm" },
  lg: { icon: "h-5 w-5", padding: "p-1.5", text: "text-base" },
};

export function SyncStatusBadge({
  status,
  className,
  showLabel = false,
  size = "sm",
}: SyncStatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-full",
            sizes.padding,
            config.bgColor,
            className
          )}
        >
          <Icon
            className={cn(
              sizes.icon,
              config.color,
              config.animate && "animate-spin"
            )}
          />
          {showLabel && (
            <span className={cn(sizes.text, config.color, "pr-1")}>
              {config.label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">{config.label}</p>
        <p className="text-muted-foreground">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Storage info component for sidebar
interface StorageInfoProps {
  usedBytes: number;
  quotaBytes: number;
  fileCount: number;
  className?: string;
}

export function StorageInfo({
  usedBytes,
  quotaBytes,
  fileCount,
  className,
}: StorageInfoProps) {
  const percentUsed = (usedBytes / quotaBytes) * 100;
  const isAlmostFull = percentUsed > 80;
  const isFull = percentUsed > 95;

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0 || isNaN(bytes)) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const safeIndex = Math.min(Math.max(i, 0), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(2)) + " " + sizes[safeIndex];
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Storage</span>
        <span className={cn(
          "font-medium",
          isFull && "text-red-600",
          isAlmostFull && !isFull && "text-amber-600"
        )}>
          {percentUsed.toFixed(1)}% used
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isFull ? "bg-red-500" : isAlmostFull ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatBytes(usedBytes)} of {formatBytes(quotaBytes)}</span>
        <span>{fileCount} files</span>
      </div>

      {isAlmostFull && (
        <p className={cn(
          "text-xs",
          isFull ? "text-red-600" : "text-amber-600"
        )}>
          {isFull
            ? "Storage full! Delete files to continue uploading."
            : "Running low on storage space."
          }
        </p>
      )}
    </div>
  );
}
