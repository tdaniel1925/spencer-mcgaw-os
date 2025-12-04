"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileSpreadsheet,
  File,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Loader2,
  ExternalLink,
  Clock,
  User,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileRecord, formatFileSize, getFileCategory } from "@/lib/files/types";
import { useFiles } from "@/lib/files";
import { format } from "date-fns";

interface FilePreviewProps {
  file: FileRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function FilePreview({
  file,
  open,
  onOpenChange,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: FilePreviewProps) {
  const { downloadFile } = useFiles();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [activeTab, setActiveTab] = useState("preview");

  const category = file ? getFileCategory(file.mimeType) : "other";

  // Load preview URL when file changes
  useEffect(() => {
    if (!file || !open) {
      setPreviewUrl(null);
      setLoading(false);
      setError(null);
      setZoom(1);
      setRotation(0);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        // For images, PDFs, and videos, we can get a signed URL
        if (["image", "pdf", "video", "audio"].includes(category)) {
          const url = await downloadFile(file.id, true); // true = get URL only
          if (url) {
            setPreviewUrl(url);
          } else {
            setError("Could not load preview");
          }
        } else {
          // For other files, show file info only
          setPreviewUrl(null);
        }
      } catch (err) {
        console.error("Error loading preview:", err);
        setError("Failed to load preview");
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [file, open, category, downloadFile]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && hasNext && onNext) {
        onNext();
      } else if (e.key === "ArrowLeft" && hasPrevious && onPrevious) {
        onPrevious();
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasNext, hasPrevious, onNext, onPrevious, onOpenChange]);

  const handleDownload = async () => {
    if (!file) return;
    await downloadFile(file.id);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };

  const getCategoryIcon = () => {
    switch (category) {
      case "image":
        return <ImageIcon className="h-5 w-5" />;
      case "video":
        return <Film className="h-5 w-5" />;
      case "audio":
        return <Music className="h-5 w-5" />;
      case "pdf":
      case "document":
        return <FileText className="h-5 w-5" />;
      case "spreadsheet":
        return <FileSpreadsheet className="h-5 w-5" />;
      default:
        return <File className="h-5 w-5" />;
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <File className="h-16 w-16 mb-4 opacity-50" />
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download Instead
          </Button>
        </div>
      );
    }

    if (!previewUrl) {
      // Show file info for non-previewable files
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center mb-4">
            {getCategoryIcon()}
          </div>
          <p className="text-lg font-medium text-foreground mb-1">{file?.name}</p>
          <p className="text-sm mb-4">{file?.mimeType || "Unknown type"}</p>
          <p className="text-sm mb-6">{file ? formatFileSize(file.sizeBytes) : ""}</p>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download File
          </Button>
        </div>
      );
    }

    // Render based on file type
    switch (category) {
      case "image":
        return (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/5">
            <img
              src={previewUrl}
              alt={file?.name}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        );

      case "pdf":
        return (
          <iframe
            src={`${previewUrl}#toolbar=1`}
            className="w-full h-full border-0"
            title={file?.name}
          />
        );

      case "video":
        return (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video
              src={previewUrl}
              controls
              className="max-w-full max-h-full"
              autoPlay={false}
            >
              Your browser does not support video playback.
            </video>
          </div>
        );

      case "audio":
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Music className="h-16 w-16 text-primary" />
            </div>
            <p className="text-lg font-medium mb-4">{file?.name}</p>
            <audio src={previewUrl} controls className="w-full max-w-md">
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center mb-4">
              {getCategoryIcon()}
            </div>
            <p className="text-lg font-medium text-foreground mb-1">{file?.name}</p>
            <p className="text-sm mb-6">Preview not available</p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download File
            </Button>
          </div>
        );
    }
  };

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                {getCategoryIcon()}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-medium truncate">
                  {file.name}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.sizeBytes)} • {file.mimeType}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Image controls */}
              {category === "image" && previewUrl && (
                <div className="flex items-center gap-1 mr-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleRotate}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleResetZoom}>
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main content */}
        <div className="flex-1 flex min-h-0">
          {/* Preview area */}
          <div className="flex-1 relative min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="mx-4 mt-2 w-fit">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="flex-1 m-0 p-4 min-h-0">
                <div className="h-full rounded-lg border bg-muted/30 overflow-hidden">
                  {renderPreview()}
                </div>
              </TabsContent>

              <TabsContent value="details" className="flex-1 m-0 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-6">
                    {/* File Info */}
                    <div>
                      <h3 className="text-sm font-medium mb-3">File Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                          <File className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Size:</span>
                          <span className="font-medium">{formatFileSize(file.sizeBytes)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium">{file.mimeType}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Created:</span>
                          <span className="font-medium">
                            {format(new Date(file.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Modified:</span>
                          <span className="font-medium">
                            {format(new Date(file.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    {file.tags && file.tags.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {file.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Version info */}
                    <div>
                      <h3 className="text-sm font-medium mb-3">Version</h3>
                      <p className="text-sm text-muted-foreground">
                        Version {file.version}
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Navigation arrows */}
            {hasPrevious && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full shadow-lg"
                onClick={onPrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {hasNext && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full shadow-lg"
                onClick={onNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
