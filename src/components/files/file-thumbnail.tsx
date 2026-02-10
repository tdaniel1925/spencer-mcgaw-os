"use client";

import { useState, useEffect } from "react";
import { FileIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface FileThumbnailProps {
  fileId: string;
  fileName: string;
  mimeType: string;
  className?: string;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
}

/**
 * FileThumbnail - Smart thumbnail component with lazy loading
 *
 * Features:
 * - Auto-generates thumbnails for images
 * - Caches generated thumbnails
 * - Lazy loads for performance
 * - Falls back to icon for unsupported types
 */
export function FileThumbnail({
  fileId,
  fileName,
  mimeType,
  className,
  fallbackIcon: FallbackIcon = FileIcon,
}: FileThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const isImage = mimeType.startsWith('image/');

  useEffect(() => {
    // Only fetch thumbnails for images
    if (!isImage || error) return;

    const fetchThumbnail = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/files/${fileId}/thumbnail`);

        if (!response.ok) {
          throw new Error('Failed to fetch thumbnail');
        }

        const data = await response.json();
        setThumbnailUrl(data.thumbnailUrl);
      } catch (err) {
        console.error('Thumbnail fetch error:', err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThumbnail();
  }, [fileId, isImage, error]);

  // Show loading state
  if (isImage && isLoading) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-muted rounded-lg",
        className
      )}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show thumbnail for images
  if (isImage && thumbnailUrl && !error) {
    return (
      <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
        <Image
          src={thumbnailUrl}
          alt={fileName}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  // Fallback to icon
  return (
    <div className={cn(
      "flex items-center justify-center bg-muted/30 rounded-lg",
      className
    )}>
      <FallbackIcon className="h-12 w-12 text-muted-foreground" />
    </div>
  );
}
