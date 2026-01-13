"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, File, Lock, AlertCircle, FileText, Image, Video, Music, Archive, Code } from "lucide-react";
import { formatFileSize } from "@/lib/files/types";

interface ShareData {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sharedBy: string;
  expiresAt: string | null;
  requiresPassword: boolean;
  permission: "view" | "download" | "edit";
  downloadCount: number;
  maxDownloads: number | null;
  message: string | null;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="h-16 w-16 text-blue-500" />;
  if (mimeType.startsWith("video/")) return <Video className="h-16 w-16 text-purple-500" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-16 w-16 text-green-500" />;
  if (mimeType === "application/pdf") return <FileText className="h-16 w-16 text-red-500" />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar")) {
    return <Archive className="h-16 w-16 text-yellow-500" />;
  }
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("html")) {
    return <Code className="h-16 w-16 text-gray-500" />;
  }
  return <File className="h-16 w-16 text-gray-400" />;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [password, setPassword] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    async function fetchShareData() {
      try {
        const response = await fetch(`/api/files/share/${token}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401 && data.requiresPassword) {
            setPasswordRequired(true);
            setLoading(false);
            return;
          }
          throw new Error(data.error || "Failed to load share");
        }

        setShareData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load share");
      } finally {
        setLoading(false);
      }
    }

    fetchShareData();
  }, [token]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/files/share/${token}`, {
        headers: { "X-Share-Password": password },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid password");
      }

      setShareData(data);
      setPasswordRequired(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify password");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!shareData) return;

    setDownloading(true);
    setError(null);

    try {
      const response = await fetch(`/api/files/share/${token}/download`, {
        headers: password ? { "X-Share-Password": password } : {},
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Download failed");
      }

      // Get the download URL and trigger download
      const data = await response.json();

      // Create a temporary link and click it
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = shareData.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);

      // Update download count locally
      setShareData(prev => prev ? {
        ...prev,
        downloadCount: prev.downloadCount + 1,
      } : null);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Loading share...</p>
        </div>
      </div>
    );
  }

  // Password required state
  if (passwordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <CardTitle>Password Protected</CardTitle>
            <CardDescription>
              This file is password protected. Enter the password to access it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Access File"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !shareData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-2" />
            <CardTitle>Unable to Access</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-500">
              This share link may have expired, been revoked, or reached its download limit.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Share data loaded
  if (!shareData) return null;

  const isExpired = shareData.expiresAt && new Date(shareData.expiresAt) < new Date();
  const isMaxedOut = shareData.maxDownloads && shareData.downloadCount >= shareData.maxDownloads;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {getFileIcon(shareData.mimeType)}
          <CardTitle className="mt-4">{shareData.fileName}</CardTitle>
          <CardDescription>
            Shared by {shareData.sharedBy}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Size</span>
              <span className="font-medium">{formatFileSize(shareData.fileSize)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Type</span>
              <span className="font-medium">{shareData.mimeType}</span>
            </div>
            {shareData.maxDownloads && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Downloads</span>
                <span className="font-medium">
                  {shareData.downloadCount} / {shareData.maxDownloads}
                </span>
              </div>
            )}
            {shareData.expiresAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Expires</span>
                <span className="font-medium">
                  {new Date(shareData.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Message from sharer */}
          {shareData.message && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-800">{shareData.message}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Download button */}
          {isExpired ? (
            <div className="text-center text-sm text-gray-500">
              This share link has expired.
            </div>
          ) : isMaxedOut ? (
            <div className="text-center text-sm text-gray-500">
              This share link has reached its download limit.
            </div>
          ) : shareData.permission === "view" ? (
            <div className="text-center text-sm text-gray-500">
              This file is view-only. Downloads are not permitted.
            </div>
          ) : (
            <Button
              onClick={handleDownload}
              className="w-full"
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : downloadSuccess ? (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Again
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
